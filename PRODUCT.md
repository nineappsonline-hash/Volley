# 🏐 Volley Academy — Product Overview

> **The complete operating system for sports academies.**
> Manage members, subscriptions, schedules, attendance and finances from one place — and know your profit on every single session, automatically.

---

## Table of Contents

1. [What is Volley Academy?](#what-is-volley-academy)
2. [Who it's for](#who-its-for)
3. [Feature Guide](#feature-guide)
   - [Dashboard](#dashboard)
   - [Members & Subscriptions](#members--subscriptions)
   - [Payments & Receipts](#payments--receipts)
   - [Scheduling](#scheduling)
   - [Attendance & Check-in](#attendance--check-in)
   - [Financial Engine](#financial-engine-automatic)
   - [Reports & Analytics](#reports--analytics)
   - [Teams, Coaches & Venues](#teams-coaches--venues)
   - [Tournaments](#tournaments)
   - [Member Engagement](#member-engagement)
   - [Public Academy Page](#public-academy-page)
   - [Notifications & Integrations](#notifications--integrations)
4. [Built for Your Region](#built-for-your-region)
5. [Security & Reliability](#security--reliability)
6. [Key Strengths](#key-strengths)
7. [What You Get](#what-you-get)
8. [Commercial Summary](#commercial-summary)
9. [Suggested Pricing Model](#suggested-pricing-model)
10. [Why Now](#why-now)

---

## What is Volley Academy?

Volley Academy is a web-based **academy management platform** that replaces the
spreadsheets, WhatsApp groups and notebooks most academies run on today.

It handles the full lifecycle of running an academy:

```
  Enroll ──▶ Schedule ──▶ Take attendance ──▶ Bill & renew ──▶ Know your profit
```

The moment you mark a session's attendance, the platform calculates that
session's **revenue, cost and net profit** — instantly and automatically.
No end-of-month surprises. No mental math. Just clear numbers.

---

## Who it's for

| Academy type | How it helps |
|---|---|
| **Volleyball & multi-sport academies** | Full support for multiple sports, coaches, venues and age groups |
| **Single-coach academies** | Simple setup in minutes — one monthly cost entry and you're live |
| **Multi-branch operations** | Teams, venues and recurring schedules keep every location organized |
| **Any subscription-based training business** | Session-based memberships, renewals and per-session economics |

---

## Feature Guide

### Dashboard

A role-aware home screen that answers "how is my academy doing?" at a glance:

- **Total members**, **monthly revenue**, **monthly costs** and **net profit** cards
- **Smart alerts** — members running out of sessions, unpaid members, new sign-ups awaiting approval
- Upcoming sessions with per-session profit/loss indicators
- Recent announcements and incoming **trial requests**

Members see their own view: remaining sessions, attendance rate, next sessions and payment status.

### Members & Subscriptions

- Complete roster with search, filtering, sorting and pagination
- Flexible **membership plans** (e.g. Full = 8 sessions, Half = 4) — define any plan you offer
- Automatic tracking of **remaining sessions** as attendance is taken
- One-click visual statuses: ✅ Paid · ⚠️ Needs renewal · ❌ Unpaid
- Pending-signup approval queue — members join via invite code, you approve them onto the roster
- Rich member profile: payment history, attendance history, badges, evaluations and activity timeline
- **Statement PDF** export for any member — perfect for printing or emailing a payment summary

### Payments & Receipts

- Record payments with amount, date, plan, method and notes
- Payment methods supported: **cash, card, mobile wallet, bank transfer, other**
- Printable/downloadable **receipt page** for every payment
- Membership status updates automatically when a payment is recorded
- Export the full payment log to **CSV** for your accountant

### Scheduling

- Monthly calendar and list views of all training sessions
- Create sessions with sport, venue, coach, age group and skill level
- **Recurring schedule builder** — "Every Mon & Wed at 6pm" generates a whole month of sessions in one click
- Schedule templates for repeating weekly patterns
- Coach availability windows so you never double-book a coach
- Cancelled sessions are automatically excluded from all financial calculations
- Read-only **.ics calendar feed** — members subscribe once and see sessions in Google Calendar / Apple Calendar

### Attendance & Check-in

- Pick a session, toggle each member present/absent — changes save **in real time**
- **Batch actions**: select many members and mark them present/absent/export at once
- **QR code check-in**: every member gets a personal check-in code; scan or type it at the door — no queues
- **Walk-in guests**: add drop-in players who pay per session; their payments count toward session revenue automatically
- **Waitlists** when a session is full, with promotion tracking
- Live **revenue / cost / profit** readout while you're still taking attendance

### Financial Engine (automatic)

This is the heart of the platform. Enter two numbers — coach salary and court rental — and everything else computes itself:

| Concept | How it's calculated |
|---|---|
| Cost per session | `(coach salary + court rental) ÷ sessions per month` |
| Member's per-session value | `latest payment ÷ plan sessions` (e.g. EGP 1,200 ÷ 8 = EGP 150) |
| Session revenue | sum of attending members' per-session values + guest payments |
| Session profit / loss | `revenue − cost per session` |

Calculations run inside the database via triggers, so they're **always current**:
change any payment, cost or attendance record and every affected session
recalculates instantly. Profit shows green, loss shows red — everywhere.

Additional expense tracking by category (equipment, uniforms, tournaments,
travel, other) gives you true bottom-line numbers beyond court and coach costs.

### Reports & Analytics

Two dedicated insight surfaces for data-driven decisions:

**Reports**
- Revenue vs costs chart with monthly summary table
- Average profit per session
- Revenue breakdown by sport
- **Retention & churn analysis**: active members, inactive 30–60 days, inactive 60+ days
- One-click **PDF report** and **CSV payment export**

**Analytics**
- Active members, sessions completed, attendance rate and net profit
- 12-week attendance trend
- **Member health radar**: healthy / at-risk / churned segmentation — see exactly who is about to quit before they do
- Revenue forecast projecting the next 3 months from historical trends
- Coach performance comparison (average attendance per session)
- Revenue by payment method, expense breakdown by category
- Member growth over time and session-time heatmap (which hours you actually use)
- Top attendee leaderboards
- **CSV export** of the whole analytics summary

### Teams, Coaches & Venues

- Organize members into **teams** by sport, age group and skill level
- **Coach directory** with specialties and salaries feeding directly into cost calculations
- **Venue catalog** with capacity info for every court/hall you train at
- Custom sport catalog per academy — volleyball today, basketball tomorrow

### Tournaments

- Create tournaments per sport with dates and status tracking
- Manage the full match bracket: rounds, teams, scores, dates, venues
- Match history stays linked to teams and seasons

### Member Engagement

Keep members motivated and parents informed:

- **Announcements board** broadcast to all members
- **Photo galleries** attached to sessions and announcements
- **Gamification badges** awarded automatically at milestones — First Step ⭐, Regular 🔥 (10 sessions), Dedicated 💪 (25), Champion 🏆 (50), Legend 👑 (100)
- **Activity feed** — a live timeline of joins, payments, badges, ratings and check-ins
- **Player evaluations** — coaches score technique, tactics, fitness and attitude (1–5) with notes; great for parent meetings
- **Session ratings** — members rate sessions 1–5 stars with comments

### Public Academy Page

Every academy gets an optional public page at `/a/<your-name>`:

- Showcase your academy description and sports
- Visitors submit **trial request forms** that flow straight into your dashboard's trials pipeline (new → contacted → converted → declined)
- A free marketing funnel built into your management tool

### Notifications & Integrations

Professional email notifications powered by Resend:

- 💳 **Payment confirmation** emails with amount and sessions
- 🔔 **Renewal reminders** when a member runs low on sessions (one click from the dashboard, with send-history tracking)
- 🎉 **Welcome emails** for new members
- 📅 New-session notifications

Plus a personal **calendar feed (.ics)** per academy so members' phone calendars stay in sync automatically.

---

## Built for Your Region

- 🌐 **Fully bilingual English + Arabic**, with complete right-to-left (RTL) layout
- 💰 **Egyptian Pound (EGP)** currency formatting out of the box
- 🌙 Dark mode across the entire app
- 📱 Fully responsive — works on phones at the court, not just office desktops

## Security & Reliability

- **Bank-grade isolation**: every academy's data is protected by PostgreSQL Row Level Security — no academy can ever see another's data
- Role-based access enforced at the database *and* route level
- Realtime sync powered by Supabase (PostgreSQL + Realtime)
- Hosted on Vercel + Supabase — globally distributed, zero-maintenance infrastructure
- Automatic backups through managed Postgres

---

## Key Strengths

1. **Automatic profit visibility** — the killer feature. Most academies only discover their margins months later. Here, profit/loss appears the second attendance is marked.
2. **Zero-setup financial intelligence** — no accounting knowledge needed. Two inputs (salary + rent) produce a complete economic picture.
3. **Retention tools built in** — churn-risk analytics, renewal alerts and engagement features directly attack the #1 revenue killer in academies: silent dropouts.
4. **Arabic-first, RTL-native** — not a translated afterthought. The interface was designed bilingual from day one.
5. **Multi-tenant SaaS architecture** — proven ready to serve hundreds of independent academies on one platform.
6. **Everything in one place** — scheduling, billing, attendance, communication, tournaments, gamification. No more juggling 5 tools.
7. **Realtime everything** — attendance, calculations and dashboards update live across all devices simultaneously.
8. **Frictionless check-in** — QR codes and batch actions make taking attendance for 30 kids take seconds, not minutes.
9. **Export-friendly** — CSV and PDF exports everywhere keep accountants and owners happy.
10. **Modern, maintainable stack** — Next.js 14, TypeScript, Supabase, Tailwind. Fast, secure, and easy to extend.

---

## What You Get

| Capability | Included |
|---|---|
| Unlimited members & staff accounts | ✅ |
| Multi-sport / multi-venue / multi-coach | ✅ |
| Subscription & payment management | ✅ |
| QR check-in & batch attendance | ✅ |
| Automatic session profit/loss engine | ✅ |
| Reports + deep analytics + forecasts | ✅ |
| Email notifications & renewal reminders | ✅ |
| Public signup page & trial pipeline | ✅ |
| Tournaments, badges, photos, announcements | ✅ |
| English + Arabic (RTL) interface | ✅ |
| PDF & CSV exports | ✅ |
| Calendar sync (.ics) for members | ✅ |

---

## Commercial Summary

### The Problem

Sports academies across the region are run on paper, Excel and WhatsApp.
The consequences are universal:

- **Revenue leaks**: expired subscriptions go unnoticed; renewals depend on memory
- **No cost visibility**: owners can't answer "does Saturday's 6pm class make money?"
- **Churn happens silently**: members stop coming, and nobody notices for weeks
- **Admin chaos**: schedules, payments and parent communication scattered across tools

Existing alternatives are either generic club software built for gyms (heavy,
expensive, English-only) or nothing at all.

### The Solution

Volley Academy is a focused, affordable, bilingual SaaS that digitizes the
entire academy operation in under an hour of setup — with **per-session
profitability** as its signature capability. It converts administrative chaos
into a single source of truth that pays for itself through recovered renewals
and informed decisions alone.

### Target Market

- **Primary**: volleyball and multi-sport academies in Egypt and the broader MENA region — a large, underserved, fast-growing youth-sports market where Arabic-first software is a decisive differentiator
- **Secondary**: any Arabic/English-speaking subscription-based coaching business (football schools, padel clubs, swimming academies, ballet & martial arts studios)

### Value Proposition

| For | Value |
|---|---|
| Owner | Real-time profit/loss, churn detection, less admin time |
| Admin/Staff | Fast attendance, automated billing, one organized system |
| Member/Parent | Clear remaining sessions, receipts, schedule sync, engagement |

### Business Model

**BaaS (Backend-as-a-Service included)** — the platform runs on Supabase +
Vercel, so marginal hosting cost per academy is near zero. Revenue is pure
subscription:

### Suggested Pricing Model

| Tier | Price (indicative) | Includes |
|---|---|---|
| **Starter** | ~EGP 500 / mo | 1 sport, up to 50 members, core features |
| **Pro** | ~EGP 1,000 / mo | Unlimited members, analytics, tournaments, emails, public page |
| **Academy** | ~EGP 1,800 / mo | Multi-branch support, priority support, custom branding |

Supporting levers:
- **14-day free trial** (already built into the schema) — self-serve conversion funnel
- Annual plans at ~2 months free to improve cash flow and retention
- Optional future add-ons: online payment collection, WhatsApp notifications, parent mobile app

### Competitive Advantages

| Alternative | Volley Academy advantage |
|---|---|
| Spreadsheets | Automation, realtime P/L, no manual errors, works on phones |
| WhatsApp-only ops | Structured records, payments, analytics and accountability |
| Generic gym/club software | Session-based economics, Arabic/RTL, academy-specific features, fraction of the price |
| Building in-house | Production-ready today, maintained and hosted for you |

### Bottom Line

Volley Academy turns an academy's messiest back-office work into its sharpest
competitive edge: knowing exactly which sessions, sports and members make
money — while giving families a professional, modern experience. It is
architecturally ready to scale from one academy to a regional platform.

---

*Volley Academy — run your academy like a business.* 🏐
