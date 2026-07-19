'use client';

import { useEffect } from 'react';
import type { GeoPosition } from '@/hooks/useGeolocation';
import type { StationWithDistance } from '@/types/database';

// Proximity notifications — spec §6.6. Every 60s, check whether a nearby
// station is within 500 m; notify at most once per station per 2 hours
// (cooldown tracked in sessionStorage key `ca_notified_${station_id}`).
//
// MVP note: the spec routes this through a server action calling the internal
// POST /api/push/send route. Until that is deployed, we fire a *local*
// notification via the service worker registration — the sessionStorage
// cooldown is recorded either way, so swapping in server-side push later
// changes nothing else in this hook.

const PROXIMITY_KM = 0.5;
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
const CHECK_INTERVAL_MS = 60_000;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function useProximityTrigger(
  position: GeoPosition | null,
  stations: StationWithDistance[]
) {
  useEffect(() => {
    if (!position || stations.length === 0) return;

    const check = async () => {
      for (const station of stations) {
        if (haversineKm(position.lat, position.lng, station.lat, station.lng) > PROXIMITY_KM) {
          continue;
        }
        const key = `ca_notified_${station.id}`;
        try {
          const last = Number(sessionStorage.getItem(key) ?? 0);
          if (Date.now() - last < COOLDOWN_MS) continue;
          sessionStorage.setItem(key, String(Date.now()));
        } catch {
          continue; // no storage → no dedupe → skip rather than spam
        }

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted' &&
          'serviceWorker' in navigator
        ) {
          try {
            const registration =
              (await navigator.serviceWorker.getRegistration('/sw.js')) ??
              (await navigator.serviceWorker.getRegistration());
            await registration?.showNotification('Charger nearby ⚡', {
              body: `${station.display_name} is within 500 m — check your cheapest badge.`,
              icon: '/icon-192.png',
              badge: '/badge-72.png',
              data: { url: `/dashboard?station_id=${station.id}` },
            });
          } catch {
            // notification failed — cooldown already recorded, move on
          }
        }
      }
    };

    void check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [position, stations]);
}
