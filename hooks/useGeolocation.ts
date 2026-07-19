'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { capture } from '@/lib/posthog';

// GPS state machine — spec §6.2. Single source of truth for location state.
// Coordinates live in React state + sessionStorage only (cleared on tab
// close); they are NEVER sent to analytics or persisted server-side.

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'timeout';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

const STORAGE_KEY = 'ca_location';
const FRESH_MS = 5 * 60 * 1000; // restore cached position only if < 5 min old
const MAX_UNAVAILABLE_RETRIES = 3;
const UNAVAILABLE_RETRY_DELAY_MS = 3000;

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const unavailableRetries = useRef(0);
  const timedOutOnce = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSuccess = useCallback((pos: GeolocationPosition) => {
    const p: GeoPosition = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: Date.now(),
    };
    setPosition(p);
    setStatus('granted');
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // storage unavailable (private mode) — in-memory state is enough
    }
    capture('geolocation_granted'); // NO coordinates in event properties
  }, []);

  const attempt = useCallback(
    (highAccuracy: boolean) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus('unavailable');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (err) => {
          if (err.code === 1) {
            // PERMISSION_DENIED
            setStatus('denied');
            return;
          }
          if (err.code === 2) {
            // POSITION_UNAVAILABLE — retry after 3s, max 3 retries
            if (unavailableRetries.current < MAX_UNAVAILABLE_RETRIES) {
              unavailableRetries.current += 1;
              retryTimer.current = setTimeout(() => attempt(true), UNAVAILABLE_RETRY_DELAY_MS);
            } else {
              setStatus('unavailable');
            }
            return;
          }
          // TIMEOUT — retry ONCE with low accuracy, then give up
          if (!timedOutOnce.current) {
            timedOutOnce.current = true;
            attempt(false);
          } else {
            setStatus('timeout');
          }
        },
        highAccuracy
          ? { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
          : { enableHighAccuracy: false, timeout: 5000 }
      );
    },
    [onSuccess]
  );

  const request = useCallback(async () => {
    unavailableRetries.current = 0;
    timedOutOnce.current = false;
    setStatus('requesting');
    try {
      // Permissions API is not available everywhere (e.g. older Safari).
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          setStatus('denied');
          return;
        }
      }
    } catch {
      // permissions API unsupported — fall through to getCurrentPosition
    }
    attempt(true);
  }, [attempt]);

  useEffect(() => {
    // Restore a fresh cached position first to avoid re-prompting on nav.
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as GeoPosition;
        if (p && typeof p.lat === 'number' && Date.now() - p.timestamp < FRESH_MS) {
          setPosition(p);
          setStatus('granted');
          return;
        }
      }
    } catch {
      // corrupted cache — ignore
    }
    void request();
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [request]);

  return { status, position, request };
}
