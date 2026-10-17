# Playza — Academy owner presentation

- `Playza-Academy-Owners.pdf`: 16-slide, 16:9 presentation for sharing and presenting.
- `Playza-Academy-Owners.html`: editable, self-contained source with the embedded Playza logo. Print with background graphics enabled and zero margins; the print page size is defined in CSS.

## Content review

Prepared from the application source on 18 September 2026. Features are presented as capabilities, without invented customer metrics, revenue promises, or pricing.

Reviewed areas:
- Owner dashboard: `src/components/dashboard/admin-dashboard.tsx`
- Memberships, payments and evaluations: `src/components/members/`
- Sessions, recurrence and calendar export: `src/components/schedule/`
- Attendance and QR workflows: `src/components/attendance/`
- Coaches and invitations: `src/components/coaches/`
- Financial reporting: `src/app/(dashboard)/reports/page.tsx`, `src/components/reports/`
- Analytics and CSV export: `src/components/analytics/`
- AI planning and insights: `src/components/coach-ai/`, `src/components/insights/`
- Rentals and venue availability: `src/components/rentals/`, `src/components/shared/playground-availability-calendar.tsx`
- Public academy discovery, trials and family workflows: `src/app/a/`, `src/components/dashboard/trials-card.tsx`, `src/components/parent/`
- Tournaments: `src/components/tournaments/`
- Plan-dependent availability: `src/components/upgrade/plan-comparison.tsx`
- Brand palette: `src/lib/brand.ts`, `src/app/playza-palette.css`; logo: `public/logo.png`.

The workflow illustrations are labelled as illustrations, not product screenshots. Payroll and support/satisfaction database migrations were not promoted as finished owner-facing features because corresponding interfaces were not found in this review. The deck notes that feature availability and limits depend on plan and configuration.

## Quality checks

PDF verified as 16 landscape pages. All slides checked programmatically for page overflow; representative cover, workflow, finance and feature-summary slides visually inspected. Text remains selectable and the PDF is approximately 802 KB.
