import React, { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin } from 'lucide-react';

const MapRecenter = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    map.flyTo([position.lat, position.lng], map.getZoom(), { duration: 0.6 });
  }, [map, position]);

  return null;
};

const ClickToPin = ({ onChange }) => {
  useMapEvents({
    click(event) {
      onChange({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
};

const DeliveryLocationPicker = ({ value, onChange, onUseCurrentLocation, locating }) => (
  <div className="rounded-2xl border border-[#EADFD6] bg-white overflow-hidden shadow-sm">
    <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-[#EADFD6]">
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="w-4 h-4 text-[#A30F3B] shrink-0" />
        <div>
          <p className="text-xs font-bold text-[#211917]">Pin your delivery location</p>
          <p className="text-[11px] text-[#705F58]">Tap the map to move the pin precisely.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onUseCurrentLocation}
        disabled={locating}
        className="h-9 px-3 rounded-xl border border-[#A30F3B]/25 bg-[#FBECEF] text-[#A30F3B] text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-60"
      >
        <Crosshair className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
        {locating ? 'Locating' : 'Use GPS'}
      </button>
    </div>

    <MapContainer
      center={[value.lat, value.lng]}
      zoom={14}
      scrollWheelZoom={false}
      className="h-[230px] w-full"
      aria-label="Delivery location map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[value.lat, value.lng]}
        radius={11}
        pathOptions={{ color: '#FFFFFF', fillColor: '#A30F3B', fillOpacity: 1, weight: 4 }}
      >
        <Popup>Your delivery pin</Popup>
      </CircleMarker>
      <ClickToPin onChange={onChange} />
      <MapRecenter position={value} />
    </MapContainer>

    <div className="px-4 py-2.5 bg-[#FFF8F1] text-[11px] text-[#705F58] flex justify-between gap-2">
      <span>Selected coordinates</span>
      <span className="font-mono font-semibold text-[#211917]">
        {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
      </span>
    </div>
  </div>
);

export default DeliveryLocationPicker;
