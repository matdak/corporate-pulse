import { useState, useMemo, useCallback } from "react";
import { subDays, subMonths, subYears, startOfDay, isAfter, isBefore } from "date-fns";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Preset = "7d" | "30d" | "90d" | "6m" | "1y" | "2y" | "all" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last year" },
  { value: "2y", label: "Last 2 years" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

function getPresetRange(preset: Preset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "7d": return { start: subDays(now, 7), end: now };
    case "30d": return { start: subDays(now, 30), end: now };
    case "90d": return { start: subDays(now, 90), end: now };
    case "6m": return { start: subMonths(now, 6), end: now };
    case "1y": return { start: subYears(now, 1), end: now };
    case "2y": return { start: subYears(now, 2), end: now };
    case "all": return { start: new Date(2000, 0, 1), end: now };
    case "custom": return { start: subYears(now, 2), end: now };
  }
}

export function useDateFilter() {
  const [preset, setPreset] = useState<Preset>("2y");
  const [customStart, setCustomStart] = useState<Date>(subYears(new Date(), 2));
  const [customEnd, setCustomEnd] = useState<Date>(new Date());

  const { startDate, endDate } = useMemo(() => {
    if (preset === "custom") return { startDate: customStart, endDate: customEnd };
    const range = getPresetRange(preset);
    return { startDate: range.start, endDate: range.end };
  }, [preset, customStart, customEnd]);

  const filterByDate = useCallback(
    <T extends { created_utc: string }>(items: T[]): T[] => {
      const start = startOfDay(startDate);
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
      return items.filter((item) => {
        const d = new Date(item.created_utc);
        return isAfter(d, start) && isBefore(d, end);
      });
    },
    [startDate, endDate]
  );

  return { preset, setPreset, startDate, endDate, customStart, setCustomStart, customEnd, setCustomEnd, filterByDate };
}

export function DateRangeFilter({
  preset, onPresetChange,
  customStart, customEnd,
  onCustomStartChange, onCustomEndChange,
}: {
  preset: Preset;
  onPresetChange: (p: Preset) => void;
  customStart: Date;
  customEnd: Date;
  onCustomStartChange: (d: Date) => void;
  onCustomEndChange: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = PRESETS.find((p) => p.value === preset)?.label || "Select range";

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-8 text-xs font-mono gap-1.5">
            <CalendarIcon className="h-3 w-3" />
            {currentLabel}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="end">
          <div className="flex flex-col gap-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  onPresetChange(p.value);
                  if (p.value !== "custom") setOpen(false);
                }}
                className={cn(
                  "text-left text-xs font-mono px-3 py-1.5 rounded-sm hover:bg-muted transition-colors",
                  preset === p.value && "bg-muted font-bold"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="border-t mt-2 pt-2 flex gap-2">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1 px-1">From</p>
                <Calendar
                  mode="single"
                  selected={customStart}
                  onSelect={(d) => d && onCustomStartChange(d)}
                  className={cn("p-2 pointer-events-auto text-xs")}
                />
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1 px-1">To</p>
                <Calendar
                  mode="single"
                  selected={customEnd}
                  onSelect={(d) => d && onCustomEndChange(d)}
                  className={cn("p-2 pointer-events-auto text-xs")}
                />
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
