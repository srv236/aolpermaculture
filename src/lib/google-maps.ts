/// <reference types="google.maps" />
let loadPromise: Promise<typeof google> | null = null;

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
      libraries: "drawing,geometry",
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
  // Heuristic: if first value is between -90..90, treat as "lat lng"; else "lng lat"
  const [a, b] = points[0];
  const latFirst = Math.abs(a) <= 90 && Math.abs(b) > 90 ? true
                 : Math.abs(b) <= 90 && Math.abs(a) > 90 ? false
                 : a > 60 && a < 90; // many of our records have lat-first
  return points.map(([x, y]) => latFirst ? { lat: x, lng: y } : { lat: y, lng: x });
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
