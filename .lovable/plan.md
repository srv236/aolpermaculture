## Goal

Make the Harvest tab in a farm's page a rich, interactive analytics view in addition to the existing editable records table.

## Layout (Harvest tab)

Restructure the current `HarvestTab` into two sub-tabs:

1. **Insights** (new, default) — interactive dashboard
2. **Records** — current DataTable (edit/delete/export) unchanged

## Insights dashboard sections

### a) Stat cards (top row)
- Total harvest (kg) — in filtered range
- Unique crops harvested
- Active plots harvesting
- Top crop (by kg) with %
- Best month (by kg)
- Avg kg/harvest event
Each card shows a small delta vs previous period when comparable.

### b) Filter bar (drives every chart + stats)
- Date range preset: This month / Last 3 months / This year / All time / Custom
- Plot multi-select (defaults: all)
- Crop multi-select (defaults: all)
- Granularity: Day / Week / Month (auto by range)
- "Reset filters" link
Filter state lives in URL search params via `validateSearch` so views are shareable.

### c) Charts (recharts — already in deps)
- **Harvest over time** — stacked area chart, x = period, stacks = top 6 crops + "Other". Click a legend item to isolate; click a period bar to drill into that period's records below.
- **Top crops** — horizontal bar chart, total kg per crop, sortable, click to filter the dashboard to that crop.
- **Plot contribution** — donut chart, kg by plot; click slice to filter to that plot.
- **Monthly heatmap** — calendar-style month x crop grid, intensity by kg, hover for exact value. Good for spotting seasonality.
- **Continuous-harvest progress** — for crops with `is_continuous_harvest` sowings, a small-multiples line chart of cumulative pick # vs date, with remaining-yield as a faded line.

### d) Drill-down panel
Below the charts, a compact list of harvest events for the current filter selection — same columns as Records but read-only, with a "Open in Records" button that carries the filter over.

## Technical details

- **Computation**: all aggregations are client-side over the already-loaded `harvest` rows joined with `plots`/`crops` (already returned by `listHarvest`). No new server function needed. Memoize per filter state.
- **New files**:
  - `src/routes/_authenticated/farms_.$farmId.tsx` — split `HarvestTab` into `HarvestTab` (wrapper with sub-tabs) + extract the existing table into `HarvestRecordsTable`.
  - `src/components/harvest-insights.tsx` — dashboard, filter bar, all charts, stat cards, drill-down list.
  - `src/lib/harvest-analytics.ts` — pure functions: `aggregateByPeriod`, `topCrops`, `plotShare`, `monthlyMatrix`, `summaryStats`, `pickProgress`.
- **Charts**: use existing `recharts` via the `Chart*` wrappers in `src/components/ui/chart.tsx` for consistent theming.
- **Filters**: `validateSearch` adds `from`, `to`, `plots` (csv), `crops` (csv), `gran`. `useNavigate` updates them; default values omitted from URL.
- **Date formatting**: reuse `formatDate` (DD-MM-YYYY).
- **Styling**: stays within the existing earthy/field-notebook tokens; no new colors hardcoded. Crop colors derived from a stable palette of CSS tokens cycling per crop name hash.
- **Export**: keep existing CSV/XLSX/Drive/Share on the Records sub-tab. Add a "Download PNG" on each chart via `recharts` ref → `toDataURL` for shareable charts.
- **Empty states**: when filters yield 0 rows, show a friendly message + "Clear filters" button.
- **Performance**: 700+ rows expected per farm; all client-side. `useMemo` keyed on filter state + rows length.

## Out of scope (this change)

- No new DB tables, server functions, or migrations.
- No changes to Sowing/Resources/Plots tabs.
- No multi-farm comparison (can follow in a later turn if wanted).
