/**
 * Tiles.
 *
 * Default: Esri World Street Map — keyless, and it renders romanized
 * English labels alongside local names (e.g. "Machida-Shi / 町田市").
 *
 * CARTO now requires an API key on basemaps.cartocdn.com (without one it
 * serves an "API KEY REQUIRED" watermark tile), so to use CARTO set:
 *   PUBLIC_MAP_TILE_URL="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?api_key=YOUR_KEY"
 *   PUBLIC_MAP_ATTRIBUTION="&copy; OpenStreetMap &copy; CARTO"
 */
export const MAP_TILE_URL =
  import.meta.env.PUBLIC_MAP_TILE_URL ||
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

export const MAP_ATTRIBUTION =
  import.meta.env.PUBLIC_MAP_ATTRIBUTION || "Tiles &copy; Esri";

export const MARKER_COLORS: Record<string, string> = {
  start: "#e01b00",
  end: "#0b0b0c",
  waypoint: "#a86f00",
  poi: "#a86f00",
  site: "#e01b00",
};

/** Square dot with a mono label to its right, drawn as a Leaflet divIcon. */
export function markerHtml(kind: string, label: string): string {
  const color = MARKER_COLORS[kind] ?? MARKER_COLORS.poi;
  return `<div style="position:relative;width:12px;height:12px">
    <span style="display:block;width:12px;height:12px;background:${color};border:2px solid #0b0b0c;box-sizing:border-box"></span>
    <span style="position:absolute;left:16px;top:-4px;white-space:nowrap;font:600 10px/1 'JetBrains Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:#f3f1ea;background:rgba(11,11,12,.92);padding:4px 6px;border-radius:2px">${label}</span>
  </div>`;
}
