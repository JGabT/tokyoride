import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MAP_TILE_URL, MAP_ATTRIBUTION, markerHtml } from "@/lib/map";

type Point = { kind: string; label: string; lat: number; lng: number };

type Props = {
  ownerType: "tour" | "site";
  ownerId: string;
  initial: Point[];
};

const KINDS = ["start", "waypoint", "end", "poi"] as const;

export default function MapEditor({ ownerType, ownerId, initial }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);
  const lib = useRef<any>(null);
  const fitted = useRef(false);

  const [points, setPoints] = useState<Point[]>(initial);
  const [mode, setMode] = useState<string>("start");
  const [status, setStatus] = useState("");

  const pointsRef = useRef(points);
  const modeRef = useRef(mode);
  pointsRef.current = points;
  modeRef.current = mode;

  function drawPoints(L: any) {
    if (!map.current || !layer.current) return;

    layer.current.clearLayers();

    pointsRef.current.forEach((point, index) => {
      const icon = L.divIcon({
        className: "",
        html: markerHtml(point.kind, point.kind),
        iconSize: [12, 12],
      });

      const marker = L.marker([point.lat, point.lng], {
        icon,
        draggable: true,
      }).addTo(layer.current);

      marker.on("dragend", () => {
        const latlng = marker.getLatLng();
        setPoints((prev) =>
          prev.map((p, i) =>
            i === index
              ? {
                  ...p,
                  lat: Number(latlng.lat.toFixed(6)),
                  lng: Number(latlng.lng.toFixed(6)),
                }
              : p,
          ),
        );
      });
    });

    if (pointsRef.current.length > 1) {
      L.polyline(
        pointsRef.current.map((p) => [p.lat, p.lng]),
        { color: "#e01b00", weight: 2, dashArray: "6 8", opacity: 0.9 },
      ).addTo(layer.current);
    }

    if (!fitted.current && pointsRef.current.length) {
      fitted.current = true;
      if (pointsRef.current.length === 1) {
        map.current.setView(
          [pointsRef.current[0].lat, pointsRef.current[0].lng],
          12,
        );
      } else {
        map.current.fitBounds(
          pointsRef.current.map((p) => [p.lat, p.lng]),
          { padding: [64, 64], maxZoom: 13 },
        );
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !host.current) return;

      const instance = L.map(host.current, { scrollWheelZoom: true }).setView(
        [35.3836, 139.4131],
        10,
      );

      L.tileLayer(MAP_TILE_URL, {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: MAP_ATTRIBUTION,
      }).addTo(instance);

      instance.on("click", (event: any) => {
        const kind = modeRef.current;
        setPoints((prev) => [
          ...prev,
          {
            kind,
            label: kind === "poi" ? "Stop" : kind,
            lat: Number(event.latlng.lat.toFixed(6)),
            lng: Number(event.latlng.lng.toFixed(6)),
          },
        ]);
      });

      map.current = instance;
      layer.current = L.layerGroup().addTo(instance);
      lib.current = L;

      drawPoints(L);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    if (lib.current) drawPoints(lib.current);
  }, [points]);



  function update(index: number, patch: Partial<Point>) {
    setPoints((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  }

  async function save() {
    setStatus("Saving…");
    const res = await fetch("/api/admin/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerType, ownerId, features: points }),
    });
    const data = (await res.json()) as { count?: number };
    setStatus(res.ok ? `Saved ${data.count ?? 0} points.` : "Save failed.");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setMode(kind)}
              className={`mono-label border px-3 py-2 ${
                mode === kind
                  ? "border-signal bg-signal text-white"
                  : "border-ink/25 text-ink/70 hover:border-ink/50"
              }`}
            >
              + {kind}
            </button>
          ))}
          <span className="mono-label text-ink/40">
            Click the map to drop a pin
          </span>
        </div>

        <div
          ref={host}
          className="h-[480px] w-full border border-ink/15"
          style={{ background: "#e9e6dd" }}
        />
      </div>

      <div className="admin-card p-4">
        <div className="flex items-center justify-between">
          <p className="mono-label text-signal-deep">Pins</p>
          <span className="mono-label text-ink/40">{points.length}</span>
        </div>

        <div className="mt-3 space-y-2">
          {points.length === 0 && (
            <p className="text-sm text-ink/45">
              No pins yet. Pick a mode and click the map.
            </p>
          )}
          {points.map((point, index) => (
            <div key={index} className="border border-ink/12 p-2">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={point.kind}
                  onChange={(e) => update(index, { kind: e.target.value })}
                  className="field !w-auto !py-1.5 !text-sm"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setPoints((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="mono-label text-signal-deep/70 hover:text-signal-deep"
                >
                  remove
                </button>
              </div>
              <input
                value={point.label}
                onChange={(e) => update(index, { label: e.target.value })}
                placeholder="Label"
                className="field mt-2 !py-1.5 !text-sm"
              />
              <p className="mono-label mt-1 text-ink/35">
                {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
              </p>
            </div>
          ))}
        </div>

        <button type="button" onClick={save} className="hard-btn mt-4 w-full">
          Save map
        </button>
        {status && (
          <p className="mono-label mt-2 text-center text-ink/50">{status}</p>
        )}
      </div>
    </div>
  );
}
