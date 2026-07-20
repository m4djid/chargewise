'use client';

// Leaflet touches `window` — this component MUST be imported with
// next/dynamic({ ssr: false }) from the dashboard.
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import type { StationRecommendation } from '@/lib/recommendation-engine';
import type { StationWithDistance } from '@/types/database';

// Pin colors are raw hex because Leaflet injects this markup outside the
// styled component tree. They mirror the Ampere tokens:
//   ACCENT  = --amp-blue-500   (accent — station has a recommendation)
//   UNKNOWN = --amp-carbon-400 (status-unknown — no coverage / no data)
// We have no live availability data, so the status legend (green/amber/red)
// is never used on pins: blue filled = recommendation, blue outlined =
// low-confidence recommendation, gray = unknown.
const ACCENT = '#0DA2E7';
const UNKNOWN = '#A5A49E';

// Default Leaflet marker icons break under bundlers (image URLs get mangled),
// so we draw our own pin with an inline SVG divIcon.
function pinIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}"/><circle cx="14" cy="14" r="5.5" fill="#FFFFFF"/></svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });
}

// Hollow (outlined) accent pin for low-confidence recommendations.
function outlinedPinIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 1C6.8 1 1 6.8 1 14c0 9.9 13 25 13 25s13-15.1 13-25C27 6.8 21.2 1 14 1z" fill="#FFFFFF" stroke="${color}" stroke-width="2"/><circle cx="14" cy="14" r="5.5" fill="${color}"/></svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });
}

const ICONS = {
  accent: pinIcon(ACCENT),
  accentOutlined: outlinedPinIcon(ACCENT),
  unknown: pinIcon(UNKNOWN),
};

interface StationMapProps {
  center: { lat: number; lng: number };
  stations: StationWithDistance[];
  recommendations: Record<string, StationRecommendation | undefined>;
  onSelect: (stationId: string) => void;
}

export default function StationMap({ center, stations, recommendations, onSelect }: StationMapProps) {
  return (
    <MapContainer
      // Remount when the center moves — MapContainer ignores center changes.
      key={`${center.lat.toFixed(4)},${center.lng.toFixed(4)}`}
      center={[center.lat, center.lng]}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* User position — Leaflet paints this into its own SVG pane, so the
          accent token value (--amp-blue-500) is embedded as hex. */}
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={8}
        pathOptions={{ color: ACCENT, fillColor: ACCENT, fillOpacity: 0.85, weight: 2 }}
      />

      {stations.map((station) => {
        const rec = recommendations[station.id];
        const icon = rec?.recommendation
          ? rec.recommendation.confidence === 'low'
            ? ICONS.accentOutlined
            : ICONS.accent
          : ICONS.unknown;
        return (
          <Marker key={station.id} position={[station.lat, station.lng]} icon={icon}>
            <Popup>
              <div className="min-w-40">
                <p className="m-0 text-[13px] font-semibold leading-[18px] text-primary">
                  {station.display_name}
                </p>
                <p className="my-1 text-[13px] leading-[18px] text-secondary">
                  {rec?.recommendation ? (
                    <>
                      Cheapest:{' '}
                      <span className="font-mono text-primary">
                        €{rec.recommendation.estimated_total_eur.toFixed(2)}
                      </span>{' '}
                      with {rec.recommendation.display_name}
                    </>
                  ) : (
                    'No price for your badges'
                  )}
                </p>
                <button
                  onClick={() => onSelect(station.id)}
                  className="cursor-pointer rounded-sm border-0 bg-transparent p-0 text-[13px] font-semibold leading-[18px] text-accent-text transition-colors duration-fast ease-amp hover:text-accent-hover"
                >
                  View →
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
