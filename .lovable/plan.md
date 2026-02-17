
## Fix: Timeline Chart X-Axis Shows Wrong Date Range

### Problem
The "Mentions Over Time" chart always shows data from January 2000 to today because the timeline computation has a redundant date calculation that only handles 3 of the 8 presets (`7d`, `30d`, `90d`). The default preset is `2y`, which falls through to the fallback `new Date(2000, 0, 1)`.

### Root Cause
Lines 39-47 in `Index.tsx` re-derive `startDate`/`endDate` inside `timelineData` instead of using the ones already provided by the `useDateFilter` hook (which are already destructured on line 24). The inner `presetMap` is incomplete, missing `6m`, `1y`, `2y`, and `all`.

### Fix (single file change)
**File: `src/pages/Index.tsx`**

Remove the redundant inner date computation (the entire IIFE on lines 39-47) and use the `startDate` and `endDate` already returned by `useDateFilter()` on line 24. The rest of the bucketing logic stays the same.

Before:
```typescript
const timelineData = useMemo(() => {
    const { startDate, endDate } = (() => {
      if (preset === "custom") return { startDate: customStart, endDate: customEnd };
      const now = new Date();
      const presetMap: Record<string, Date> = {
        "7d": subDays(now, 7), "30d": subDays(now, 30), "90d": subDays(now, 90),
      };
      return { startDate: presetMap[preset] || new Date(2000, 0, 1), endDate: now };
    })();
    // ... bucketing logic
  }, [filteredMentions, preset, customStart, customEnd]);
```

After:
```typescript
const timelineData = useMemo(() => {
    // Use startDate/endDate from useDateFilter directly
    const days = differenceInDays(endDate, startDate);
    // ... same bucketing logic continues
  }, [filteredMentions, startDate, endDate]);
```

This ensures all presets (7d, 30d, 90d, 6m, 1y, 2y, all, custom) produce the correct X-axis range, since `useDateFilter` already handles all of them correctly.
