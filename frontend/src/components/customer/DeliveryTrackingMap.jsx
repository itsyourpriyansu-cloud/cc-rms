import React, { useEffect, useMemo } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { KITCHEN_LOCATION } from '../../context/CustomerSessionContext';

const FitRoute = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(points.map((point) => [point.lat, point.lng]), {
      padding: [34, 34],
      maxZoom: 15,
    });
  }, [map, points]);

  return null;
};

const makeRoute = (from, to) => {
  const latCurve = (to.lat - from.lat) * 0.16;
  const lngCurve = (to.lng - from.lng) * -0.12;
  return [
    from,
    {
      lat: from.lat + (to.lat - from.lat) * 0.28 + latCurve,
      lng: from.lng + (to.lng - from.lng) * 0.28 + lngCurve,
    },
    {
      lat: from.lat + (to.lat - from.lat) * 0.66 - latCurve * 0.35,
      lng: from.lng + (to.lng - from.lng) * 0.66 - lngCurve * 0.35,
    },
    to,
  ];
};

const pointOnRoute = (points, progress) => {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  const scaled = boundedProgress * (points.length - 1);
  const segment = Math.min(Math.floor(scaled), points.length - 2);
  const localProgress = scaled - segment;
  const start = points[segment];
  const end = points[segment + 1];
  return {
    lat: start.lat + (end.lat - start.lat) * localProgress,
    lng: start.lng + (end.lng - start.lng) * localProgress,
  };
};

const DeliveryTrackingMap = ({ destination, progress = 0, riderAssigned = false }) => {
  const route = useMemo(() => makeRoute(KITCHEN_LOCATION, destination), [destination]);
  const riderPosition = useMemo(() => pointOnRoute(route, progress), [route, progress]);

  return (
    <div className="rounded-[22px] overflow-hidden border border-[#EADFD6] bg-white shadow-sm">
      <MapContainer
        center={[KITCHEN_LOCATION.lat, KITCHEN_LOCATION.lng]}
        zoom={13}
        scrollWheelZoom={false}
        className="h-[285px] w-full"
        aria-label="Live delivery tracking map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline
          positions={route.map((point) => [point.lat, point.lng])}
          pathOptions={{ color: '#A30F3B', weight: 5, opacity: 0.82, dashArray: '9 8' }}
        />
        <CircleMarker
          center={[KITCHEN_LOCATION.lat, KITCHEN_LOCATION.lng]}
          radius={10}
          pathOptions={{ color: '#FFFFFF', fillColor: '#8D1230', fillOpacity: 1, weight: 4 }}
        >
          <Popup>{KITCHEN_LOCATION.label}</Popup>
        </CircleMarker>
        <CircleMarker
          center={[destination.lat, destination.lng]}
          radius={10}
          pathOptions={{ color: '#FFFFFF', fillColor: '#247A4A', fillOpacity: 1, weight: 4 }}
        >
          <Popup>Your delivery address</Popup>
        </CircleMarker>
        {riderAssigned && (
          <CircleMarker
            center={[riderPosition.lat, riderPosition.lng]}
            radius={13}
            pathOptions={{ color: '#FFFFFF', fillColor: '#E97818', fillOpacity: 1, weight: 5 }}
          >
            <Popup>Rider location</Popup>
          </CircleMarker>
        )}
        <FitRoute points={[KITCHEN_LOCATION, destination]} />
      </MapContainer>

      <div className="px-4 py-3 bg-[#FFF8F1] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex w-2.5 h-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-emerald-600" />
          </span>
          <span className="text-[11px] font-bold text-[#211917]">
            {riderAssigned ? 'Live rider position' : 'Route ready after rider pickup'}
          </span>
        </div>
        <span className="text-[10px] text-[#705F58]">Map data © OpenStreetMap</span>
      </div>
    </div>
  );
};

export default DeliveryTrackingMap;
