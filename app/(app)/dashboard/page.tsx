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
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-slate-800" />,
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
    <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function CityFallback({ onPick }: { onPick: (c: { lat: number; lng: number }) => void }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-center">
      <p className="font-semibold">We couldn&apos;t determine your position</p>
      <p className="mt-1 text-sm text-slate-400">Pick a city to browse chargers instead:</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {CITY_PRESETS.map((c) => (
          <button
            key={c.name}
            onClick={() => onPick(c)}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-400"
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-sm">
          {RADII.map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`rounded-md px-3 py-1.5 transition ${
                radius === r ? 'bg-emerald-500 font-semibold text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {permission === 'default' && (
            <button
              onClick={subscribe}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-emerald-500/60 hover:text-emerald-400"
            >
              🔔 Enable alerts
            </button>
          )}
          <button
            onClick={() => openLogSession()}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
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
          <div className="h-[45vh] overflow-hidden rounded-xl border border-slate-800">
            <StationMap
              center={pos}
              stations={stations}
              recommendations={recs}
              onSelect={setSelectedId}
            />
          </div>

          {isLoading && <Spinner label="Finding chargers near you…" />}
          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              Could not load nearby stations. Pull to refresh or try again shortly.
            </p>
          )}
          {!isLoading && !error && stations.length === 0 && (
            <p className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-center text-sm text-slate-400">
              No chargers within {radius} km. Try a wider radius.
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
