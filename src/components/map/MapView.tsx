import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { MAP_TILE_URL, MAP_ATTRIBUTION, markerHtml } from "@/lib/map";

export type MapPoint = {
  lat: string | number;
  lng: string | number;
  label?: string;
  kind?: "start" | "end" | "waypoint" | "poi" | "site";
};

type Props = {
  points: MapPoint[];
  height?: number;
  zoom?: number;
  className?: string;
  interactive?: boolean;
};

export default function MapView({
  points,
  height = 380,
  zoom = 11,
  className = "",
  interactive = true,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(points);

  useEffect(() => {
    let map: any;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !host.current) return;

      map = L.map(host.current, {
        scrollWheelZoom: false,
        dragging: interactive,
        zoomControl: interactive,
        attributionControl: true,
      }).setView([35.3836, 139.4131], zoom);

      L.tileLayer(MAP_TILE_URL, {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: MAP_ATTRIBUTION,
      }).addTo(map);

      const coords: [number, number][] = [];

      points.forEach((point) => {
        const lat = Number(point.lat);
        const lng = Number(point.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        coords.push([lat, lng]);

        const icon = L.divIcon({
          className: "",
          html: markerHtml(
            point.kind ?? "poi",
            point.label ?? point.kind ?? "stop",
          ),
          iconSize: [12, 12],
        });

        L.marker([lat, lng], { icon, interactive: false }).addTo(map);
      });

      if (coords.length > 1) {
        L.polyline(coords, {
          color: "#e01b00",
          weight: 2,
          opacity: 0.9,
          dashArray: "6 8",
        }).addTo(map);
        map.fitBounds(coords, { padding: [48, 48], maxZoom: 12 });
      } else if (coords.length === 1) {
        map.setView(coords[0], zoom);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [key, interactive, zoom]);

  return (
    <div
      ref={host}
      className={`relative w-full overflow-hidden border border-ink/15 bg-[#e9e6dd] ${className}`}
      style={{ height }}
      role="img"
      aria-label="Route map"
    />
  );
}
