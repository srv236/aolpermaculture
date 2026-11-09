import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  { key: "Jan", label: "January", short: "Jan", index: 0 },
  { key: "Feb", label: "February", short: "Feb", index: 1 },
  { key: "Mar", label: "March", short: "Mar", index: 2 },
  { key: "Apr", label: "April", short: "Apr", index: 3 },
  { key: "May", label: "May", short: "May", index: 4 },
  { key: "Jun", label: "June", short: "Jun", index: 5 },
  { key: "Jul", label: "July", short: "Jul", index: 6 },
  { key: "Aug", label: "August", short: "Aug", index: 7 },
  { key: "Sep", label: "September", short: "Sep", index: 8 },
  { key: "Oct", label: "October", short: "Oct", index: 9 },
  { key: "Nov", label: "November", short: "Nov", index: 10 },
  { key: "Dec", label: "December", short: "Dec", index: 11 },
];

const PRESETS = [
  { label: "Kharif (Jun - Jul)", value: "Jun - Jul" },
  { label: "Rabi (Oct - Nov)", value: "Oct - Nov" },
  { label: "Zaid (Mar - Apr)", value: "Mar - Apr" },
  { label: "Monsoon (Jun - Sep)", value: "Jun - Sep" },
  { label: "Winter (Nov - Feb)", value: "Nov - Feb" },
  { label: "Summer (Mar - May)", value: "Mar - May" },
  { label: "All Year Round", value: "All year round" },
];

interface MonthCalendarPickerProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
}

export function MonthCalendarPicker({
  value,
  onChange,
  label = "Sowing Window",
}: MonthCalendarPickerProps) {
  // Determine start & end months from the current value
  const parsedRange = useMemo(() => {
    if (!value || !value.trim()) return { start: null, end: null, isAllYear: false };
    if (value.toLowerCase().includes("all year")) {
      return { start: "Jan", end: "Dec", isAllYear: true };
    }

    const parts = value.split(/[-–—to]+/).map((s) => s.trim());
    if (parts.length >= 2) {
      const startMatch = MONTHS.find(
        (m) =>
          m.short.toLowerCase() === parts[0].slice(0, 3).toLowerCase() ||
          parts[0].toLowerCase().startsWith(m.short.toLowerCase()),
      );
      const endMatch = MONTHS.find(
        (m) =>
          m.short.toLowerCase() === parts[1].slice(0, 3).toLowerCase() ||
          parts[1].toLowerCase().startsWith(m.short.toLowerCase()),
      );
      return {
        start: startMatch ? startMatch.short : null,
        end: endMatch ? endMatch.short : null,
        isAllYear: false,
      };
    } else if (parts.length === 1) {
      const match = MONTHS.find(
        (m) =>
          m.short.toLowerCase() === parts[0].slice(0, 3).toLowerCase() ||
          parts[0].toLowerCase().startsWith(m.short.toLowerCase()),
      );
      return {
        start: match ? match.short : null,
        end: null,
        isAllYear: false,
      };
    }
    return { start: null, end: null, isAllYear: false };
  }, [value]);

  const [pickingEnd, setPickingEnd] = useState(false);

  function isMonthSelected(monthShort: string): boolean {
    if (parsedRange.isAllYear) return true;
    if (!parsedRange.start) return false;
    if (!parsedRange.end) return parsedRange.start === monthShort;

    const startIdx = MONTHS.findIndex((m) => m.short === parsedRange.start);
    const endIdx = MONTHS.findIndex((m) => m.short === parsedRange.end);
    const currentIdx = MONTHS.findIndex((m) => m.short === monthShort);

    if (startIdx === -1 || endIdx === -1) return false;

    // Normal range: e.g. Jun (5) to Aug (7)
    if (startIdx <= endIdx) {
      return currentIdx >= startIdx && currentIdx <= endIdx;
    }
    // Wrapping range: e.g. Nov (10) to Feb (1)
    return currentIdx >= startIdx || currentIdx <= endIdx;
  }

  function handleMonthClick(monthShort: string) {
    if (parsedRange.isAllYear) {
      // Reset from all year to single month
      onChange(monthShort);
      setPickingEnd(true);
      return;
    }

    if (!parsedRange.start || !pickingEnd) {
      // First click: select start month
      onChange(monthShort);
      setPickingEnd(true);
    } else {
      // Second click: select end month and complete range
      const startShort = parsedRange.start;
      if (startShort === monthShort) {
        onChange(monthShort);
      } else {
        onChange(`${startShort} - ${monthShort}`);
      }
      setPickingEnd(false);
    }
  }

  function handleStartChange(mShort: string) {
    const endShort = parsedRange.end;
    if (endShort && endShort !== mShort) {
      onChange(`${mShort} - ${endShort}`);
    } else {
      onChange(mShort);
    }
    setPickingEnd(false);
  }

  function handleEndChange(mShort: string) {
    const startShort = parsedRange.start || "Jan";
    if (startShort === mShort) {
      onChange(startShort);
    } else {
      onChange(`${startShort} - ${mShort}`);
    }
    setPickingEnd(false);
  }

  function handleClear() {
    onChange("");
    setPickingEnd(false);
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <Calendar className="size-3.5 text-primary" />
          <span>{label}</span>
        </Label>
        {value ? (
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="font-mono text-[11px] px-2 py-0.5">
              {value}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleClear}
              title="Clear selection"
            >
              <RotateCcw className="size-3" />
            </Button>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">None selected</span>
        )}
      </div>

      {/* Quick Season Presets */}
      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
          Seasonal Presets
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PRESETS.map((p) => {
            const isMatch = value === p.value;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  onChange(p.value);
                  setPickingEnd(false);
                }}
                className={cn(
                  "text-[11px] px-2 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1",
                  isMatch
                    ? "bg-primary text-primary-foreground border-primary font-medium shadow-2xs"
                    : "bg-background hover:bg-muted text-foreground border-border/80",
                )}
              >
                {isMatch && <Check className="size-3" />}
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Month Calendar Grid (Jan - Dec, strictly months - no years or days) */}
      <div className="p-2.5 rounded-lg border bg-muted/40 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Month Calendar Picker</span>
          <span className="text-[10px]">
            {pickingEnd ? "Click to set End Month" : "Click to select Month or Range"}
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {MONTHS.map((m) => {
            const isSelected = isMonthSelected(m.short);
            const isStart = parsedRange.start === m.short;
            const isEnd = parsedRange.end === m.short;

            return (
              <button
                key={m.key}
                type="button"
                onClick={() => handleMonthClick(m.short)}
                className={cn(
                  "py-2 px-1 rounded-md text-xs font-medium text-center transition-all cursor-pointer border select-none",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs scale-[1.02]"
                    : "bg-background text-foreground hover:bg-muted border-border/70",
                  (isStart || isEnd) && "ring-2 ring-primary ring-offset-1",
                )}
                title={m.label}
              >
                {m.short}
              </button>
            );
          })}
        </div>

        {/* Dropdowns for Range Start & End (strictly dropdowns, zero free text) */}
        <div className="pt-2 border-t grid grid-cols-2 gap-2 text-xs">
          <div>
            <Label className="text-[10px] text-muted-foreground block mb-1">From Month</Label>
            <Select value={parsedRange.start || ""} onValueChange={handleStartChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Start month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.short} value={m.short} className="text-xs">
                    {m.label} ({m.short})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground block mb-1">To Month</Label>
            <Select
              value={parsedRange.end || parsedRange.start || ""}
              onValueChange={handleEndChange}
              disabled={!parsedRange.start}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="End month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.short} value={m.short} className="text-xs">
                    {m.label} ({m.short})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
