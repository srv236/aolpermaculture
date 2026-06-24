## Farm Attendance Log

Going with the **Agrarian Register** look — paper-style monthly grid with color-coded status pills, click-cell popover for status + note, and a visitors card panel below. Defaults (you skipped): **per-farm** scope, statuses **Present / Absent / Half-day / Leave / Holiday**.

### Database (one migration)

1. Enum `attendance_status`: `present`, `absent`, `half_day`, `leave`, `holiday`.
2. Table `attendance` — one row per sevak per farm per day:
   - `worker_id` → workers, `farm_id` → farms, `date`, `status`, `notes`
   - unique (`worker_id`, `farm_id`, `date`)
3. Enum `visitor_type`: `farmer`, `government`, `previous_sevak`, `students`, `other`.
4. Table `farm_visitors` — per-day visitor entries:
   - `farm_id`, `date`, `visitor_name`, `visitor_type`, `count`, `description`
5. RLS + GRANTs matching the workers table (all authenticated read; editors/admins write).

### Server functions (`src/lib/attendance.functions.ts`)
- `listAttendance({ farmId, year, month })` — joins workers
- `upsertAttendance({ worker_id, farm_id, date, status, notes })`
- `bulkMarkPresent({ farm_id, date, worker_ids })`
- `deleteAttendance({ id })`
- `listVisitors({ farmId, date })`, `upsertVisitor`, `deleteVisitor`

### UI — `src/routes/_authenticated/attendance.tsx`
- Header: Farm select + Month/Year dropdown + Export (CSV/Excel/PDF via existing exporter).
- Grid: sticky-left Sevak column (name + role chip), sticky-top date headers with a tick button per day to "Mark all present". Weekends shaded. Only sevaks active during that month are shown.
- Each cell is a colored pill (P / A / H / L / Hol). Click → popover with the 5 status buttons + notes textarea + Save. A small dot on the pill indicates a note exists.
- Below grid: **Visitors** section bound to a selected date (defaults to today). Card grid with type chip, count, description, edit/delete, and "+ Log visitor" dialog.
- Sidebar: add "Attendance" item under Sevaks (CalendarCheck icon).

### Export
Reuses `DataTable` exporter for a flattened month export (one row per sevak-day) and a separate visitors export.

### Out of scope
No bulk import, no monthly totals column, no per-sevak history page (the grid row is the view). All easy to add later.
