import { useState, useMemo } from "react";
import { format, subDays, subYears, startOfDay, isAfter, isBefore } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function useDateFilter() {
  const [startDate, setStartDate] = useState<Date>(subYears(new Date(), 2));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const filterByDate = useMemo(() => {
    return <T extends { created_utc: string }>(items: T[]): T[] => {
      const start = startOfDay(startDate);
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
      return items.filter((item) => {
        const d = new Date(item.created_utc);
        return isAfter(d, start) && isBefore(d, end);
      });
    };
  }, [startDate, endDate]);

  return { startDate, setStartDate, endDate, setEndDate, filterByDate };
}

export function DateRangeFilter({
  startDate, endDate, onStartChange, onEndChange,
}: {
  startDate: Date; endDate: Date;
  onStartChange: (d: Date) => void; onEndChange: (d: Date) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <DatePicker label="From" date={startDate} onSelect={onStartChange} />
      <span className="text-xs font-mono text-muted-foreground">–</span>
      <DatePicker label="To" date={endDate} onSelect={onEndChange} />
    </div>
  );
}

function DatePicker({ label, date, onSelect }: { label: string; date: Date; onSelect: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 w-[140px] justify-start text-left text-xs font-mono", !date && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-1.5 h-3 w-3" />
          {date ? format(date, "MMM dd, yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onSelect(d)}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
