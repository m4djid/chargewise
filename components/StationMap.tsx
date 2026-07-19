'use client';

// Leaflet touches `window` — this component MUST be imported with
// next/dynamic({ ssr: false }) from the dashboard.
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import type { StationRecommendation } from '@/lib/recommendation-engine';
import type { StationWithDistance } from '@/types/database';

const GREEN = '#10b981'; // has a recommendation
const AMBER = '#f59e0b'; // low-confidence recommendation
const GRAY = '#64748b'; // no coverage / no badges / still loading

// Default Leaflet marker icons break under bundlers (image URLs get mangled),
// so we draw our own pin with an inline SVG divIcon.
function pinIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}"/><circle cx="14" cy="14" r="5.5" fill="#fff"/></svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });
}

const ICONS = {
  green: pinIcon(GREEN),
  amber: pinIcon(AMBER),
  gray: pinIcon(GRAY),
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

      {/* User position */}
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={8}
        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.85, weight: 2 }}
      />

      {stations.map((station) => {
        const rec = recommendations[station.id];
        const icon = rec?.recommendation
          ? rec.recommendation.confidence === 'low'
            ? ICONS.amber
            : ICONS.green
          : ICONS.gray;
        return (
          <Marker key={station.id} position={[station.lat, station.lng]} icon={icon}>
            <Popup>
              <div style={{ minWidth: 160 }}>
                <p style={{ fontWeight: 600, margin: 0 }}>{station.display_name}</p>
                <p style={{ margin: '4px 0' }}>
                  {rec?.recommendation
                    ? `Cheapest: €${rec.recommendation.estimated_total_eur.toFixed(2)} with ${rec.recommendation.display_name}`
                    : 'No price for your badges'}
                </p>
                <button
                  onClick={() => onSelect(station.id)}
                  style={{
                    color: '#059669',
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
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
