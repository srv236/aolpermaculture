import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import { cn } from "@/lib/utils";

const SCALES = [100, 150, 200] as const;
type Scale = (typeof SCALES)[number];
const KEY = "aol.fontScale";

function apply(scale: Scale) {
  if (typeof document === "undefined") return;
  // 16px is the browser default; tailwind sizes are rem-based so this scales everything.
  document.documentElement.style.fontSize = `${(scale / 100) * 16}px`;
}

export function FontSizeToggle() {
  const [scale, setScale] = useState<Scale>(100);

  useEffect(() => {
    const raw = Number(localStorage.getItem(KEY));
    const initial = (SCALES as readonly number[]).includes(raw) ? (raw as Scale) : 100;
    setScale(initial);
    apply(initial);
  }, []);

  function set(s: Scale) {
    setScale(s);
    apply(s);
    try { localStorage.setItem(KEY, String(s)); } catch {}
  }

  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <Type className="size-3.5 opacity-60 shrink-0" />
      <div className="flex-1 inline-flex rounded-md border border-sidebar-border overflow-hidden">
        {SCALES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => set(s)}
            aria-pressed={scale === s}
            title={`Font size ${s}%`}
            className={cn(
              "flex-1 text-[10px] uppercase tracking-wider py-1 transition",
              scale === s
                ? "bg-sidebar-accent text-sidebar-primary"
                : "hover:bg-sidebar-accent/60 opacity-70",
            )}
          >
            {s}%
          </button>
        ))}
      </div>
    </div>
  );
}
