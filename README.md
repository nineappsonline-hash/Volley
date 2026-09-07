# 🏐 Volleyra

A complete full-stack web application for managing sports academies — members,
attendance tracking, payments, and **automatic profit/loss calculations**.

Built with **Next.js 14 (App Router)**, **Supabase** (Auth + Postgres + Realtime),
**Tailwind CSS + shadcn/ui**, **React Query**, **Zustand**, **React Hook Form + Zod**,
**date-fns** and **Recharts**. Deploys to **Vercel**. Supports **English + Arabic (RTL)**,
dark mode, and Egyptian Pound (EGP) currency.

---

## Features

### Roles
| Role   | Access |
|--------|--------|
| **Admin** | Everything: members, payments, schedule, attendance, costs, reports, member accounts |
| **Member** | Read-only view of their own data: profile, attendance history, remaining sessions, schedule |

### Admin
- **Dashboard** — total members, monthly revenue, monthly costs, net profit/loss, upcoming sessions, recent session P/L
- **Members** — table with search/filter/sort/pagination, add/edit/delete, record & remove payments
- **Member details** — payment history, attendance history, remaining-sessions progress
- **Schedule** — monthly/weekly calendar + list view, create/edit/delete sessions
- **Attendance** — pick a session, toggle members present/absent (saves in realtime), instant **revenue / cost / profit-loss** per session
- **Costs** — monthly coach salary + court rental → automatic **cost per session**
- **Reports** — revenue vs costs chart, monthly summary table, average profit per session

### Financial engine (automatic)
- `Cost per session = (Coach salary + Court rental) ÷ Sessions per month`
- `Revenue per session = Σ (latest payment ÷ subscription sessions) for attending members`
- `Profit/Loss per session = Revenue − Cost per session`
- Recalculated by **database triggers** whenever attendance, payments or costs change, and reflected instantly in the UI (green = profit, red = loss).

### Member
- Personal stats: remaining sessions (progress bar), attendance rate, payment status
- Attendance history, upcoming schedule, session cost info, editable profile

---

## Tech Stack

- **Next.js 14** (App Router, TypeScript) · **Tailwind CSS + shadcn/ui**
- **Supabase** — Auth (email/password), PostgreSQL, Realtime (`postgres_changes`)
- **TanStack Query** (server state) + **Zustand** (language preference)
- **React Hook Form + Zod** · **date-fns** · **Recharts** · **next-themes** · **Sonner**

---

## 1. Project Setup

```bash
npm install
cp .env.local.example .env.local
```

Fill `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>   # for "Add member" (server only)
```

Run locally:

```bash
npm run dev
```

---

## 2. Database Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.
   This creates all tables, RLS policies, realtime publications, and the
   financial-calculation triggers.
3. Create the **first admin**:
   - Create a user in **Authentication → Users** (or let someone sign up).
   - Copy their UUID and run in the SQL Editor:
     ```sql
     UPDATE public.profiles SET role = 'admin' WHERE id = '<user-uuid>';
     ```
   - They sign in and are now an admin. (The trigger keeps the JWT role claim in sync.)
4. (Optional) Enable Realtime for the tables if not done automatically:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE attendance, session_calculations, payments, training_sessions;
   ```

> **Security notes**
> - All tables use **Row Level Security**: admins have full access; members only see their own data.
> - The role lives in `auth.users.raw_app_meta_data.role`, synced by the
>   `sync_role_claim` trigger — the Next.js middleware reads it to protect routes.
> - `SUPABASE_SERVICE_ROLE_KEY` is only used server-side in `/api/admin/users`
>   (admin creates member accounts with a temporary password).

---

## 3. Deploy to Vercel

1. Push the repo to GitHub and import it in [vercel.com](https://vercel.com).
2. Add the three environment variables from `.env.local` in **Project → Settings → Environment Variables**.
3. Deploy. That's it — `supabase/schema.sql` handles the backend.

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected app shell
│   │   ├── dashboard/        # Role-aware home
│   │   ├── members/          # Admin: members + [id] details
│   │   ├── schedule/         # Calendar + session CRUD
│   │   ├── attendance/       # Mark attendance + live P/L
│   │   ├── costs/            # Monthly cost calculator
│   │   ├── reports/          # Charts & financial summary
│   │   └── profile/          # Member profile
│   ├── login/ signup/        # Auth pages
│   ├── api/admin/users/      # Admin creates member accounts (service role)
│   └── auth/callback/        # Auth code exchange
├── components/
│   ├── ui/                   # shadcn/ui primitives
│   ├── layout/               # Sidebar, topbar, toggles, notifications
│   ├── dashboard/ members/ schedule/ attendance/ costs/ reports/ profile/
├── lib/
│   ├── supabase/             # browser, server, middleware, admin clients
│   ├── i18n/                 # EN/AR dictionary + provider (RTL)
│   ├── queries.ts            # React Query hooks & mutations
│   ├── calculations.ts       # financial engine (mirrors DB triggers)
│   └── session.ts            # server-side route guards
├── middleware.ts             # auth + role-based route protection
└── store/                    # Zustand (language)
```

---

## How the financial math works

| Concept | Formula |
|---|---|
| Cost per session | `(coach_salary + court_rental) / sessions_per_month` |
| Member's per-session value | `latest payment amount / subscription sessions (default 8)` |
| Session revenue | sum of per-session values of **attending** members |
| Session profit/loss | `revenue - cost per session` |

Database triggers recompute `session_calculations` on every attendance/payment/cost
change, and the attendance screen shows the result **immediately** while marking.

### Platform administration

The `/admin` page is restricted to the verified Supabase Auth account
`mo.dowaik@gmail.com`. It requires `SUPABASE_SERVICE_ROLE_KEY` on the server.
Apply `supabase/migrations/20260907190000_platform_admin.sql` using the Supabase
SQL editor before using it. The migration also appears at the end of `schema.sql`.
It restricts existing super-admin database permissions, denies blocked users
through RLS, and installs `public.check_account_access` as the PostgREST
`db_pre_request` hook so blocked accounts cannot call security-definer RPCs with
old access tokens. If your deployment already has a custom pre-request hook,
combine its checks with this function before applying the configuration change.

The page includes searchable account and academy records, membership editing,
Auth bans, permanent account deletion with email confirmation, friendly-game
participants, and daily playground schedules. Account deletion uses Supabase Auth
and existing foreign-key deletion rules; it does not delete the academy itself.
Playground rental coverage merges overlapping bookings and includes bookings
crossing midnight. Rental gaps do not establish opening hours or availability:
training/tournament durations and friendly-game venue associations are not yet
stored. New platform controls currently use English labels.

Run `node tests/platform-admin.cjs`, `npm run typecheck`, and `npm run build`
to verify the local implementation. Live authorization, bans, and deletion should
be exercised on test accounts after applying the migration.
