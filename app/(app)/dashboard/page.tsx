'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import LocationPermissionBanner from '@/components/LocationPermissionBanner';
import SessionFeedbackModal, { type SessionPrefill } from '@/components/SessionFeedbackModal';
import StationCard, { type LogSessionPrefill } from '@/components/StationCard';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useProximityTrigger } from '@/hooks/useProximityTrigger';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { fetcher } from '@/lib/fetcher';
import type { StationRecommendation } from '@/lib/recommendation-engine';
import type { StationWithDistance } from '@/types/database';

// Leaflet touches window — must never render on the server.
const StationMap = dynamic(() => import('@/components/StationMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-subtle" />,
});

const SESSION_KWH = 30; // default session size (spec §6.4)
const RADII = [5, 10, 25] as const;
const FEEDBACK_DELAY_MS = 30 * 60 * 1000; // spec §6.5

// Manual fallback when GPS is unavailable / times out.
const CITY_PRESETS = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Lyon', lat: 45.764, lng: 4.8357 },
  { name: 'Strasbourg', lat: 48.5734, lng: 7.7521 },
  { name: 'Marseille', lat: 43.2965, lng: 5.3698 },
];

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-tertiary">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent" />
      <p className="text-[14px] leading-[20px]">{label}</p>
    </div>
  );
}

function CityFallback({ onPick }: { onPick: (c: { lat: number; lng: number }) => void }) {
  return (
    <div className="rounded-lg border border-default bg-surface p-6 text-center shadow-sm">
      <p className="text-[14px] font-semibold leading-[20px] text-primary">
        We couldn&apos;t determine your position
      </p>
      <p className="mt-1 text-[14px] leading-[20px] text-secondary">
        Pick a city to browse chargers instead:
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {CITY_PRESETS.map((c) => (
          <button
            key={c.name}
            onClick={() => onPick(c)}
            className="h-8 rounded-md border border-default bg-surface px-4 text-[14px] font-medium leading-[20px] text-primary transition-colors duration-fast ease-amp hover:bg-hover"
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const searchParams = useSearchParams();
  const deepLinkStationId = searchParams.get('station_id');

  const geo = useGeolocation();
  const { permission, subscribe } = usePushNotifications();

  const [manualPos, setManualPos] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState<(typeof RADII)[number]>(5);
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkStationId);
  const [modal, setModal] = useState<{ open: boolean; prefill?: SessionPrefill }>({ open: false });
  const [recs, setRecs] = useState<Record<string, StationRecommendation>>({});

  const pos = geo.position ?? manualPos;

  // Round coords to 4 decimals in the SWR key so tiny GPS jitter doesn't refetch.
  const nearbyKey = pos
    ? `/api/stations/nearby?lat=${pos.lat.toFixed(4)}&lng=${pos.lng.toFixed(4)}&radius_km=${radius}`
    : null;
  const { data, error, isLoading } = useSWR<{ stations: StationWithDistance[] }>(
    nearbyKey,
    fetcher,
    { revalidateOnFocus: false }
  );
  const stations = data?.stations ?? [];

  // Fetch recommendations once per distinct station set.
  const stationSetKey = stations.map((s) => s.id).sort().join('|');
  const lastFetchedSet = useRef('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackScheduled = useRef(false);

  useEffect(() => {
    if (!stationSetKey || lastFetchedSet.current === stationSetKey) return;
    lastFetchedSet.current = stationSetKey;
    const ids = stationSetKey.split('|');
    let cancelled = false;

    fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_ids: ids, session_kwh: SESSION_KWH }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('recommendations_failed'))))
      .then((body: { results: StationRecommendation[] }) => {
        if (cancelled) return;
        setRecs((prev) => {
          const next = { ...prev };
          for (const r of body.results ?? []) next[r.station_id] = r;
          return next;
        });
        // One-shot session feedback prompt 30 min after the FIRST
        // recommendations arrive (spec §6.5).
        if (!feedbackScheduled.current) {
          feedbackScheduled.current = true;
          feedbackTimer.current = setTimeout(() => setModal({ open: true }), FEEDBACK_DELAY_MS);
        }
      })
      .catch(() => {
        if (!cancelled) lastFetchedSet.current = ''; // allow retry on next render
      });

    return () => {
      cancelled = true;
    };
  }, [stationSetKey]);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  // Deep link: /dashboard?station_id=xxx highlights + scrolls to the card.
  useEffect(() => {
    if (deepLinkStationId) setSelectedId(deepLinkStationId);
  }, [deepLinkStationId]);

  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`station-${selectedId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [selectedId, stationSetKey]);

  // Proximity push checks (real GPS position only — not city presets).
  useProximityTrigger(geo.position, stations);

  const openLogSession = (prefill?: LogSessionPrefill) => setModal({ open: true, prefill });

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-default bg-subtle p-1 text-[14px] leading-[20px]">
          {RADII.map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`h-8 rounded-md px-3 transition-colors duration-fast ease-amp ${
                radius === r
                  ? 'bg-surface font-semibold text-accent-text shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <span className="font-mono">{r}</span> km
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {permission === 'default' && (
            <button
              onClick={subscribe}
              className="flex h-8 items-center gap-2 rounded-md border border-default bg-surface px-3 text-[14px] leading-[20px] text-primary transition-colors duration-fast ease-amp hover:bg-hover"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              Enable alerts
            </button>
          )}
          <button
            onClick={() => openLogSession()}
            className="h-8 rounded-md bg-accent px-3 text-[14px] font-semibold leading-[20px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active"
          >
            Log my session
          </button>
        </div>
      </div>

      {/* Location state machine */}
      {!pos && (geo.status === 'idle' || geo.status === 'requesting') && (
        <Spinner label="Locating you…" />
      )}
      {!pos && geo.status === 'denied' && (
        <div className="space-y-4">
          <LocationPermissionBanner onRetry={() => void geo.request()} />
          <CityFallback onPick={setManualPos} />
        </div>
      )}
      {!pos && (geo.status === 'unavailable' || geo.status === 'timeout') && (
        <CityFallback onPick={setManualPos} />
      )}

      {pos && (
        <div className="space-y-4">
          {/* Map on top (45vh), scrollable card list below */}
          <div className="h-[45vh] overflow-hidden rounded-lg border border-default">
            <StationMap
              center={pos}
              stations={stations}
              recommendations={recs}
              onSelect={setSelectedId}
            />
          </div>

          {isLoading && <Spinner label="Finding chargers near you…" />}
          {error && (
            <p className="rounded-lg border border-status-danger bg-status-danger-bg p-3 text-[14px] leading-[20px] text-status-danger">
              Could not load nearby stations. Pull to refresh or try again shortly.
            </p>
          )}
          {!isLoading && !error && stations.length === 0 && (
            <p className="rounded-lg border border-default bg-subtle p-4 text-center text-[14px] leading-[20px] text-secondary">
              No chargers within <span className="font-mono">{radius}</span> km. Try a wider radius.
            </p>
          )}

          <div className="space-y-3">
            {stations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                rec={recs[station.id]}
                sessionKwh={SESSION_KWH}
                highlighted={selectedId === station.id}
                onLogSession={openLogSession}
              />
            ))}
          </div>
        </div>
      )}

      <SessionFeedbackModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        prefill={modal.prefill}
        stations={stations.map((s) => ({ id: s.id, name: s.display_name }))}
      />
    </div>
  );
}

// useSearchParams requires a Suspense boundary in the App Router.
export default function DashboardPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <Dashboard />
    </Suspense>
  );
}
