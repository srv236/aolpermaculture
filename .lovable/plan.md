# Farm Management System — Build Plan

A clean, internal-looking web app (not generic AI dashboard) for managing farms, plots, crops, sowing & harvest records, with admin-managed users and Google Maps polygon drawing.

## Visual direction

Calm, earthy, "field notebook" feel — warm off-white background, deep forest-green primary, muted clay accents, serif headings (e.g. Fraunces) + clean sans (Inter) for data. Dense tables but generous spacing in forms. Left sidebar with farm switcher, top-right user menu. No purple gradients.

## Pages / Surfaces

Single app shell, sidebar + content area:

1. `/auth` — Sign-in only (no public signup). Forgot password supported.
2. `/farms` — Farm list + "Add farm" (map polygon).
3. `/farms/$farmId` — Farm detail with tabs: **Overview · Plots · Sowing · Harvest**.
4. `/crops` — Crop variety library (CRUD).
5. `/admin/users` — Admin-only: user list, invite/create user, set role, deactivate.

All authenticated routes live under `_authenticated/`. `/admin/*` additionally gated by `has_role(admin)`.

## Data model (Lovable Cloud / Postgres)

Tables (snake_case, all with RLS + grants):

- `profiles` — id (= auth.users.id), full_name, email, is_active, created_at. Auto-created via trigger on signup.
- `user_roles` — (user_id, role enum: `admin|editor|viewer`). Separate table; `has_role()` security-definer function. Admin seeded for Srinivas Venkatraman / srv.236@gmail.com.
- `farms` — id, name, farming_type, total_acreage, latitude, longitude, geopolygon (text WKT for now), state, district, owner_name, contact_email, contact_phone, established_year, notes, is_active, timestamps.
- `plots` — id, farm_id (fk), plot_number, acreage, geopolygon, soil_type, irrigation_type, elevation, slope_percent, aspect, notes, is_active, timestamps.
- `crops` — id, crop_name, variety_name, crop_category, yield_unit, description, typical_yield_per_acre, growing_days, is_active, timestamps.
- `sowing_records` — id, plot_id, variety_id, planting_date, quantity_planted, quantity_unit, seed_source, expected_first_harvest, expected_final_harvest, status enum (`planned|active|completed|failed|abandoned`), is_continuous_harvest, estimated_harvest_interval_days, is_replanting, original_sowing_id, area_utilized_percent, notes, timestamps.
- `harvest_records` — id, plot_id, variety_id, sowing_id (nullable), harvest_date, harvest_time_start, harvest_time_end, quantity_harvested, quality_grade, harvest_sequence_number, estimated_remaining_yield, notes, timestamps.

RLS:
- `viewer` → SELECT everything.
- `editor` → SELECT + INSERT/UPDATE/DELETE on farms/plots/crops/sowing/harvest (but not user_roles).
- `admin` → all of the above + user/role management.
- `profiles` self-read; admin reads all.

Seed data migration loads:
- Crops (from CropTable.xlsx)
- Farms 2 & 53 (FarmsTable.xlsx)
- Plots from PlotsTable-2.xlsx → farm 2, PlotsTable.xlsx → farm 53
- Sowing + harvest rows (mapped by plot_number)
- Admin profile placeholder for Srinivas (created on first sign-in by trigger; role grant via migration that matches on email)

## Forms & flows

- **Add/Edit Farm**: name, location text, Google Map (satellite) with Drawing Manager — draw polygon → centroid auto-fills lat/lng, polygon stored as WKT; metadata fields (state, district, owner, contact, year, notes).
- **Add/Edit Plot** (inside farm): name, acreage (auto-computed from polygon area but editable), polygon drawn over farm map, soil/irrigation/elevation/slope/aspect/notes.
- **Create Sowing Record**: plot picker, crop variety picker (searchable), planting date, quantity + unit, seed source, expected first/final harvest, status, continuous-harvest toggle + interval days, replanting toggle + original sowing reference, area utilization %, notes.
- **Create Harvest Record**: plot picker, crop variety, harvest date + start/end time, quantity (kg), quality grade, optional sequence number + remaining yield (shown only if linked sowing is continuous), notes.
- **Crops CRUD**: table editor with inline add/edit/delete + active toggle.
- **Users (admin only)**: list users with role + status; "Add user" creates auth account with temp password + emails reset link; change role; deactivate.

## Retrieval / tables

Each tab shows a sortable, filterable, paginated table (TanStack Table) with row actions Edit / Delete (with confirm). "Download CSV" button on every table exports current filtered view client-side (Papa Parse). Inline edit via dialog form.

## Map integration

Google Maps JS API via the existing Lovable Google Maps connector browser key. `loading=async` + `callback=initMap`, classic `google.maps.Map` (no `mapId`), `google.maps.drawing` library for polygon drawing/editing. Polygons stored as WKT (`POLYGON((lng lat, ...))`) to match your sheet format. Reusable `<FarmMap>` and `<PolygonDrawer>` components.

## Auth

- Lovable Cloud email/password only (no public signup UI).
- `/auth` route shows Sign-in form + "Forgot password" → `resetPasswordForEmail` → `/reset-password` page sets new password.
- Admin creates users from `/admin/users` via a server function that uses `supabaseAdmin.auth.admin.createUser` and inserts profile + `user_roles` row.
- Sign-out hygiene per stack rules.

## Tech specifics

- TanStack Start + Query, shadcn/ui, Tailwind v4.
- Server functions in `src/lib/*.functions.ts` using `requireSupabaseAuth`; admin operations check `has_role('admin')` then dynamically import `client.server` for `supabaseAdmin`.
- Google Maps connector — uses `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` already linked.
- CSV export via `papaparse`.

## Out of scope (call out)

- Mobile native app.
- Offline mode.
- Photo uploads on records (can add later if wanted).
- Analytics/yield charts (can add as a follow-up).

## Build order

1. Enable Lovable Cloud; create migration with schema, enums, RLS, grants, `has_role`, profile trigger.
2. Seed migration importing your 7 sheets.
3. Auth pages + protected layout + role gates.
4. App shell (sidebar, farm switcher).
5. Farms CRUD with Google Maps polygon.
6. Plots CRUD inside farm detail.
7. Crops CRUD.
8. Sowing + Harvest CRUD with tables, edit dialogs, CSV download.
9. Admin Users management.
10. Polish + seed admin role for srv.236@gmail.com.

Approve and I'll start building.