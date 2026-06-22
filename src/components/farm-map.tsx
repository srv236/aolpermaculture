/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, parseWkt, toWkt, centroid } from "@/lib/google-maps";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

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
  const drawingMgrRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapEl.current) return;
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

        const baseStyle: google.maps.PolygonOptions = {
          fillColor: "#4ade80", fillOpacity: 0.25,
          strokeColor: "#15803d", strokeWeight: 2,
          editable: !readOnly, clickable: true,
        };

        function emit(poly: google.maps.Polygon) {
          if (!onChange) return;
          const arr = poly.getPath().getArray().map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
          onChange(toWkt(arr));
        }
        function attachEdit(poly: google.maps.Polygon) {
          const path = poly.getPath();
          const handler = () => emit(poly);
          g.maps.event.addListener(path, "set_at", handler);
          g.maps.event.addListener(path, "insert_at", handler);
          g.maps.event.addListener(path, "remove_at", handler);
        }

        if (initialPath) {
          const poly = new g.maps.Polygon({ ...baseStyle, paths: initialPath, map });
          polygonRef.current = poly;
          if (!readOnly) attachEdit(poly);
        }

        if (!readOnly) {
          const gAny = g as any;
          const dm = new gAny.maps.drawing.DrawingManager({
            drawingMode: polygonRef.current ? null : gAny.maps.drawing.OverlayType.POLYGON,
            drawingControl: !polygonRef.current,
            drawingControlOptions: {
              position: g.maps.ControlPosition.TOP_CENTER,
              drawingModes: [gAny.maps.drawing.OverlayType.POLYGON],
            },
            polygonOptions: baseStyle,
          });
          dm.setMap(map);
          drawingMgrRef.current = dm;
          g.maps.event.addListener(dm, "polygoncomplete", (poly: google.maps.Polygon) => {
            polygonRef.current?.setMap(null);
            polygonRef.current = poly;
            attachEdit(poly);
            dm.setDrawingMode(null);
            dm.setOptions({ drawingControl: false });
            emit(poly);
          });
        }
      })
      .catch((e) => setError(e.message));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearPolygon() {
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    const dm = drawingMgrRef.current;
    if (dm) {
      dm.setOptions({ drawingControl: true });
      dm.setDrawingMode((window as any).google.maps.drawing.OverlayType.POLYGON);
    }
    onChange?.(null);
  }

  return (
    <div className="space-y-2">
      <div ref={mapEl} style={{ width: "100%", height }} className="rounded-md border bg-muted" />
      {error && <div className="text-xs text-destructive">Map error: {error}</div>}
      {!readOnly && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={clearPolygon}>
            <Trash2 className="size-3.5 mr-1" /> Clear polygon
          </Button>
        </div>
      )}
    </div>
  );
}
