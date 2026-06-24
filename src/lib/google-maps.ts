/// <reference types="google.maps" />
let loadPromise: Promise<typeof google> | null = null;
const DEFAULT_CENTER = { lat: 12.82, lng: 77.5 };

declare global {
  interface Window {
    __initGoogleMaps?: () => void;
  }
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
    if (!key) {
      reject(new Error("Google Maps key missing"));
      return;
    }
    window.__initGoogleMaps = () => resolve(window.google!);
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key,
      libraries: "geometry",
      loading: "async",
      callback: "__initGoogleMaps",
    });
    if (channel) params.set("channel", channel);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

// ----- WKT helpers (POLYGON((lng lat, ...))) -----
export function parseWkt(wkt: string | null | undefined): google.maps.LatLngLiteral[] | null {
  if (!wkt) return null;
  const m = wkt.match(/POLYGON\s*\(\(([^)]+)\)\)/i);
  if (!m) return null;
  const points = m[1].split(",").map((p) => p.trim().split(/\s+/).map(Number));
  if (!points.length) return null;

  const lngLat = points.map(([lng, lat]) => ({ lat, lng }));
  const latLng = points.map(([lat, lng]) => ({ lat, lng }));
  const lngLatValid = isValidPath(lngLat);
  const latLngValid = isValidPath(latLng);

  if (lngLatValid && !latLngValid) return normalizePath(lngLat);
  if (latLngValid && !lngLatValid) return normalizePath(latLng);
  if (!lngLatValid && !latLngValid) return null;

  // Standard WKT stores coordinates as lng lat. Some migrated records were
  // lat lng, and both are numerically valid around Bangalore (12, 77), so pick
  // the orientation whose centroid is closest to the farm area's default view.
  const lngLatDistance = distanceToDefault(centroid(lngLat));
  const latLngDistance = distanceToDefault(centroid(latLng));
  return normalizePath(lngLatDistance <= latLngDistance ? lngLat : latLng);
}

export function toWkt(path: google.maps.LatLngLiteral[]): string {
  if (!path.length) return "";
  const closed = path[0].lat === path[path.length - 1].lat && path[0].lng === path[path.length - 1].lng
    ? path : [...path, path[0]];
  // Store lng lat (standard WKT order)
  return `POLYGON((${closed.map((p) => `${p.lng} ${p.lat}`).join(",")}))`;
}

export function centroid(path: google.maps.LatLngLiteral[]): google.maps.LatLngLiteral | null {
  if (!path.length) return null;
  let lat = 0, lng = 0;
  for (const p of path) { lat += p.lat; lng += p.lng; }
  return { lat: lat / path.length, lng: lng / path.length };
}

function isValidPath(path: google.maps.LatLngLiteral[]) {
  return path.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
}

function normalizePath(path: google.maps.LatLngLiteral[]) {
  if (path.length > 1) {
    const first = path[0];
    const last = path[path.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) return path.slice(0, -1);
  }
  return path;
}

function distanceToDefault(point: google.maps.LatLngLiteral | null) {
  if (!point) return Number.POSITIVE_INFINITY;
  return (point.lat - DEFAULT_CENTER.lat) ** 2 + (point.lng - DEFAULT_CENTER.lng) ** 2;
}
