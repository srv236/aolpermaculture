/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, parseWkt, toWkt, centroid } from "@/lib/google-maps";
import { Button } from "@/components/ui/button";
import { Pencil, Check, Trash2, Undo2 } from "lucide-react";

type Props = {
  value?: string | null;
  onChange?: (wkt: string | null) => void;
  readOnly?: boolean;
  height?: number | string;
  initialCenter?: google.maps.LatLngLiteral;
  overlays?: Array<{ wkt: string; color?: string; label?: string }>;
};

export function FarmMap({ value, onChange, readOnly, height = 400, initialCenter, overlays }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const draftMarkersRef = useRef<google.maps.Marker[]>([]);
  const draftPolylineRef = useRef<google.maps.Polyline | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const googleRef = useRef<typeof google | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);

  function emit(poly: google.maps.Polygon) {
    if (!onChange) return;
    const arr = poly.getPath().getArray().map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
    onChange(toWkt(arr));
  }

  function attachEdit(poly: google.maps.Polygon) {
    const g = googleRef.current!;
    const path = poly.getPath();
    const handler = () => emit(poly);
    g.maps.event.addListener(path, "set_at", handler);
    g.maps.event.addListener(path, "insert_at", handler);
    g.maps.event.addListener(path, "remove_at", handler);
  }

  function clearDraft() {
    draftMarkersRef.current.forEach((m) => m.setMap(null));
    draftMarkersRef.current = [];
    draftPolylineRef.current?.setMap(null);
    draftPolylineRef.current = null;
    if (clickListenerRef.current) {
      clickListenerRef.current.remove();
      clickListenerRef.current = null;
    }
  }

  function startDrawing() {
    const g = googleRef.current;
    const map = mapRef.current;
    if (!g || !map) return;
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    onChange?.(null);
    clearDraft();
    setDrawing(true);

    const polyline = new g.maps.Polyline({
      map,
      path: [],
      strokeColor: "#15803d",
      strokeWeight: 2,
    });
    draftPolylineRef.current = polyline;

    clickListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      const marker = new g.maps.Marker({
        position: pt, map,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 5, fillColor: "#15803d", fillOpacity: 1,
          strokeColor: "#fff", strokeWeight: 2,
        },
      });
      draftMarkersRef.current.push(marker);
      polyline.getPath().push(e.latLng);
    });
  }

  function undoLastPoint() {
    const marker = draftMarkersRef.current.pop();
    marker?.setMap(null);
    const path = draftPolylineRef.current?.getPath();
    if (path && path.getLength() > 0) path.removeAt(path.getLength() - 1);
  }

  function finishDrawing() {
    const g = googleRef.current;
    const map = mapRef.current;
    if (!g || !map) return;
    const pts = draftMarkersRef.current.map((m) => {
      const p = m.getPosition()!;
      return { lat: p.lat(), lng: p.lng() };
    });
    clearDraft();
    setDrawing(false);
    if (pts.length < 3) return;
    const poly = new g.maps.Polygon({
      paths: pts, map,
      fillColor: "#4ade80", fillOpacity: 0.25,
      strokeColor: "#15803d", strokeWeight: 2,
      editable: true, clickable: true,
    });
    polygonRef.current = poly;
    attachEdit(poly);
    emit(poly);
  }

  function clearPolygon() {
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    clearDraft();
    setDrawing(false);
    onChange?.(null);
  }

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapEl.current) return;
        googleRef.current = g;
        const initialPath = parseWkt(value) || undefined;
        const ctr = initialPath ? centroid(initialPath) : initialCenter || { lat: 12.82, lng: 77.5 };
        const map = new g.maps.Map(mapEl.current, {
          center: ctr!,
          zoom: initialPath ? 17 : 14,
          mapTypeId: g.maps.MapTypeId.HYBRID,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;

        for (const o of overlays || []) {
          const p = parseWkt(o.wkt);
          if (!p) continue;
          new g.maps.Polygon({
            paths: p, map,
            fillColor: o.color || "#f4d35e", fillOpacity: 0.15,
            strokeColor: o.color || "#f4d35e", strokeWeight: 1.5, clickable: false,
          });
        }

        if (initialPath) {
          const poly = new g.maps.Polygon({
            paths: initialPath, map,
            fillColor: "#4ade80", fillOpacity: 0.25,
            strokeColor: "#15803d", strokeWeight: 2,
            editable: !readOnly, clickable: true,
          });
          polygonRef.current = poly;
          if (!readOnly) attachEdit(poly);
        }
      })
      .catch((e) => setError(e.message));
    return () => { cancelled = true; clearDraft(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <div ref={mapEl} style={{ width: "100%", height }} className="rounded-md border bg-muted" />
      {error && <div className="text-xs text-destructive">Map error: {error}</div>}
      {!readOnly && (
        <div className="flex justify-between items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {drawing
              ? "Click on the map to add vertices, then click Finish."
              : polygonRef.current
                ? "Drag the vertices to adjust the polygon."
                : "Click Draw polygon to outline the area."}
          </div>
          <div className="flex gap-1">
            {drawing ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={undoLastPoint}>
                  <Undo2 className="size-3.5 mr-1" /> Undo
                </Button>
                <Button type="button" size="sm" onClick={finishDrawing}>
                  <Check className="size-3.5 mr-1" /> Finish
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={startDrawing}>
                <Pencil className="size-3.5 mr-1" /> {polygonRef.current ? "Redraw" : "Draw polygon"}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={clearPolygon}>
              <Trash2 className="size-3.5 mr-1" /> Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
