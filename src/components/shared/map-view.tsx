"use client";

import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/geo";

const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" fill="#2563eb" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const DEFAULT_ZOOM = 13;

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    const next = Math.max(map.getZoom(), DEFAULT_ZOOM);
    if (
      Math.abs(map.getCenter().lat - center.lat) > 1e-6 ||
      Math.abs(map.getCenter().lng - center.lng) > 1e-6
    ) {
      map.setView([center.lat, center.lng], next);
    }
  }, [center, map]);
  return null;
}

function ClickSetter({ onPick }: { onPick: (loc: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function DraggableMarker({
  position,
  onPick,
}: {
  position: LatLng;
  onPick: (loc: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={pinIcon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          onPick({ lat: ll.lat, lng: ll.lng });
        },
      }}
    />
  );
}

interface MapViewProps {
  center: LatLng;
  marker: LatLng | null;
  onPick: (loc: LatLng) => void;
}

export function MapView({ center, marker, onPick }: MapViewProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="z-0 h-full w-full"
      style={{ height: "100%", minHeight: 260 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} />
      {marker ? (
        <DraggableMarker position={marker} onPick={onPick} />
      ) : (
        <ClickSetter onPick={onPick} />
      )}
    </MapContainer>
  );
}

export default MapView;