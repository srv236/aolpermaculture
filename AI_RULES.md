# Tech Stack

- **React 19 & TypeScript**: Strict TypeScript throughout the codebase with modern React features and hooks.
- **TanStack Start & Vite**: Full-stack framework combining Vite bundling with TanStack Start server functions and SSR/client capabilities.
- **TanStack Router**: File-based routing located strictly in `src/routes/` with `__root.tsx` as the app shell.
- **TanStack Query**: Server-state management and query caching (`@tanstack/react-query`) paired with `useServerFn` for calling server functions.
- **Supabase**: Backend database (PostgreSQL with Row Level Security), authentication, and storage via `@supabase/supabase-js`.
- **Tailwind CSS v4**: Utility-first CSS using modern Tailwind v4 (`@tailwindcss/vite`) and custom theme styling in `src/styles.css`.
- **shadcn/ui & Radix UI**: Component library built on accessible Radix primitives located in `src/components/ui/`.
- **TanStack Table & Recharts**: Complex data tables with sorting, filtering, and CSV export via `@tanstack/react-table`, alongside data visualization via `recharts`.
- **Lucide React**: Primary icon library (`lucide-react`) for consistent iconography.

---

# Library & Architectural Rules

### 1. Routing & Navigation
- All routes belong in `src/routes/`. Follow TanStack Router file-naming conventions (`$param.tsx`, `_authenticated/`, etc.).
- Never create `src/pages/` or Next.js/Remix-style `app/` structures.
- Use `useNavigate` and `<Link>` from `@tanstack/react-router` for all internal navigation.

### 2. Server Functions & Data Flow
- Place server functions in `src/lib/*.functions.ts` using `createServerFn`.
- Protect server functions that access user data with `.middleware([requireSupabaseAuth])`.
- In client components, invoke server functions via `useServerFn(...)` within TanStack Query's `useQuery` or `useMutation`.
- Invalidate relevant query keys after mutations using `useQueryClient().invalidateQueries({ queryKey: [...] })`.

### 3. Database Mutations & Payload Hygiene
- **Never pass joined rows or UI-computed columns directly into Supabase `.update()` or `.insert()`** (e.g. `crop_label`, `plot_number`, joined objects like `plots` or `crops`). PostgREST will fail with schema cache errors.
- Always sanitize or whitelist payload fields to match the Supabase table schema before executing mutations.

### 4. UI Components & Styling
- Use existing prebuilt components from `src/components/ui/` (Button, Dialog, Input, Select, Table, Badge, Card, Popover, etc.).
- Use Tailwind utility classes for layout, spacing, and styling.
- Use `cn()` from `@/lib/utils` for conditional class combinations.
- Use `lucide-react` for all icons.

### 5. Forms & Validation
- For standard forms, use `react-hook-form` with `zod` validation schemas and `@hookform/resolvers/zod`.
- Keep dialog form state clean and sanitize string/numeric inputs (convert empty string values to `null` or numbers as expected by the database).

### 6. User Feedback
- Use `sonner` (`toast.success()`, `toast.error()`) for mutation feedback and error messages.

### 7. Tables & Data Export
- Use `src/components/data-table.tsx` (`@tanstack/react-table`) for tabular views with search and pagination.
- Use `papaparse` or `xlsx` for CSV/Excel exports, and `jspdf` / `html2canvas-pro` for PDF exports.
