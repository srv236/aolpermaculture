## Goal
Make the Harvest Insights filter bar faster to use when there are many crops, and make every chart tooltip carry meaningful stats instead of just a kg number.

## 1. Bulk crop control (Crops dropdown)

Rebuild the Crops multi-select popover with:

- **Search box** at the top — filters the list as you type (matches crop name + category).
- **Select all / Clear** buttons on the header row, scoped to whatever the search currently shows (so "select all" after typing "tomato" picks just the tomato varieties).
- **Top N chips** — "Top 5" and "Top 10" — pick the highest-yield crops within the currently active date range (respects year/month/preset filters, ignores the current crop filter so it can re-pick).
- **Group by category** — list is sectioned by category (greens, vegetable, fruit, herb, legume, grain, perennial, other), each section header has its own tick-all toggle and a count (e.g. "Greens · 6").

Plots dropdown gets the same search + select-all/clear treatment for consistency (cheap to add once the component exists).

## 2. Richer tooltips (all charts)

One shared `InsightsTooltip` component used by the time series, top-crops bar, and plot donut.

**Time series (stacked area)** — hovering a bucket shows:
- Header: bucket label (e.g. "Mar 2026"), period total kg, number of harvest events.
- Δ vs previous bucket: `+12.4 kg (+8%)` in green / red.
- Cumulative to date: running kg from the start of the visible range.
- Per-crop rows: color swatch, crop name, kg, % share of the bucket — sorted high → low, only crops with a value in that bucket.

**Top crops bar** — hovering a bar shows:
- Crop name, total kg, % of all harvest in the filtered range.
- Harvest event count, number of plots it came from.
- Δ vs the previous equivalent period (e.g. previous month if granularity = month, else previous 30 days).

**Plot donut** — hovering a slice shows:
- Plot name, total kg, % of farm total.
- Top 3 crops on that plot with kg and share.
- Event count.

All tooltips share the same card styling (bg-card, soft border, small caption text) so they read as one system.

## 3. Supporting data work in `src/lib/harvest-analytics.ts`

Add pure helpers so the component stays thin:
- `topCropsInRange(rows, n)` → ordered crop keys for the Top N chips.
- `cropsByCategory(rows)` → `{ category: CropOption[] }` for the grouped dropdown.
- `bucketBreakdown(rows, bucketKey)` → `{ total, eventCount, perCrop: [{ key, name, kg, pct }] }` for the time-series tooltip.
- `bucketDelta(series, index)` → `{ deltaKg, deltaPct }`.
- `cumulativeTo(series, index)` → running kg.
- `cropStats(rows, cropKey, range)` → totals, event count, plot count, prev-period delta.
- `plotBreakdown(rows, plotId)` → totals, event count, top crops.

## 4. Files touched

- `src/components/harvest-insights.tsx` — rebuild Crops/Plots popovers, wire new tooltip into the three charts.
- `src/components/insights-tooltip.tsx` *(new)* — shared tooltip card.
- `src/lib/harvest-analytics.ts` — add helpers listed above.

No backend, schema, or routing changes. Other pages unaffected.

## Out of scope
- Saving crop selections as presets.
- Exporting the tooltip breakdown.
- Changing the chart types or colors.
