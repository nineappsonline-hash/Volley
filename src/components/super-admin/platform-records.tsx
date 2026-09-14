"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { matchesAdminSearch } from "@/lib/admin-record-search";
import { rentalCoverage, type RentalInterval } from "@/lib/admin-schedule";
import { PLATFORM_ADMIN_EMAIL, matchesAccountEmail } from "@/lib/platform-admin";
import { useSuperAdminDeleteAcademy } from "@/lib/queries";
import type { Academy, VenueUnavailableSlot } from "@/lib/types";
import type { Dict } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n";
import { blockedIntervalsForDate, closedIntervalsFromWorkingHours, formatBlockedSlot, isValidSlotList, weekdayOf } from "@/lib/venue-slots";
import { parseMapsCoordinates } from "@/lib/maps";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { AcademyEditDialog } from "./academy-edit-dialog";
import { LocationFields } from "@/components/shared/location-fields";
import { Label } from "@/components/ui/label";
import { Ban, Clock, Plus, Trash2 } from "lucide-react";
import { minutesOf } from "@/lib/venue-slots";
import { formatMoney } from "@/lib/constants";
import { DirectionsLinks } from "@/components/shared/directions-links";

type Row = Record<string, any>;
type Records = Record<string, Row[]>;

/** Venue draft (create/edit dialog state) with a typed excluded-times list
 * and the weekly working-hours configuration. */
interface VenueDraft extends Row {
  unavailable_slots?: VenueUnavailableSlot[];
  working_hours?: VenueUnavailableSlot[];
  court_count?: string | number;
}

/** Label lookup for detail rows built with canonical English keys. */
const ROW_LABELS: Record<string, keyof Dict> = {
  Email: "sa_records_email",
  Phone: "sa_records_phone",
  Membership: "sa_records_membership",
  "Platform plan": "sa_platform_plan",
  "Subscription sessions": "sa_subscription_sessions",
  "Sessions attended": "sa_sessions_attended",
  "Account status": "sa_account_status",
  "Membership status": "sa_membership_status",
  "Membership type": "sa_membership_type",
  Joined: "sa_joined",
  "Premium expires": "sa_premium_expires",
  Academy: "sa_academy",
  Country: "sa_form_country",
  Governorate: "sa_form_governorate",
  "City / area": "sa_form_area",
  Address: "sa_address",
  "Academy plan": "sa_academy_plan",
  Created: "sa_created",
  "Trial ends": "sa_trial_ends",
  "Session bookings": "sa_session_bookings",
  "Platform fee": "sa_platform_fee",
  Location: "sa_location",
  Capacity: "sa_capacity",
  "Rental cost (EGP / hour)": "sa_rental_cost_hour",
  "Rental hours": "sa_rental_hours",
  Sessions: "sa_records_sessions",
  "Price (EGP)": "sa_price",
  Status: "sa_status",
  "Main branch": "sa_main_branch",
};

const STATUS_LABELS: Record<string, keyof Dict> = {
  scheduled: "sa_records_scheduled",
  completed: "sa_records_completed",
  canceled: "sa_records_cancelled",
};

/** Deletion confirmation phrase: account email, else member email, else the
 * family member's name (children have no login or email). */
function confirmPhrase(row: Row | null): string | null {
  if (!row) return null;
  return row.account_email ?? row.email ?? row.name ?? null;
}
function confirmMatches(confirmation: string, row: Row | null): boolean {
  return matchesAccountEmail(confirmation, confirmPhrase(row));
}
/** Playground details dialog: readable, structured view without raw ids. */
function VenueDetails({ venue, data }: { venue: Row; data: Records }) {
  const { t, lang } = useI18n();
  const notSet = t("sa_not_set");
  const sportName = data.sports.find(s => s.id === venue.sport_id)?.name;
  const academyName = venue.academy_id
    ? data.academies.find(a => a.id === venue.academy_id)?.name ?? t("sa_academy_unavailable")
    : t("sa_unassigned");
  const coords = typeof venue.lat === "number" && typeof venue.lng === "number"
    ? ({ lat: venue.lat, lng: venue.lng } as const)
    : parseMapsCoordinates(venue.location_link ?? "");
  const location = [venue.country, venue.governorate, venue.area].filter(Boolean).join(" · ") || notSet;
  const slots = ((venue.unavailable_slots ?? []) as VenueUnavailableSlot[])
    .slice()
    .sort((a, b) => a.weekday - b.weekday || minutesOf(a.start) - minutesOf(b.start));
  const workingHours = ((venue.working_hours ?? []) as VenueUnavailableSlot[])
    .slice()
    .sort((a, b) => a.weekday - b.weekday || minutesOf(a.start) - minutesOf(b.start));
  const rentals = data.venue_rentals
    .filter(r => r.venue_id === venue.id)
    .sort((a, b) => b.rental_date.localeCompare(a.rental_date) || b.start_time.localeCompare(a.start_time));
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2 text-xs">
      {sportName && <span className="rounded-full bg-muted px-3 py-1 font-medium">{sportName}</span>}
      <span className="rounded-full bg-muted px-3 py-1 font-medium">{academyName}</span>
      {Number(venue.court_count) > 1 && <span className="rounded-full bg-muted px-3 py-1 font-medium">{venue.court_count} {t("rentals_courts_short")}</span>}
    </div>
    <dl className="grid grid-cols-3 gap-2 text-center">
      {[
        { k: t("sa_capacity"), v: venue.capacity ?? notSet },
        { k: t("sa_rental_cost_hour"), v: venue.rental_cost != null ? formatMoney(venue.rental_cost, lang) : notSet },
        { k: t("sa_court_count"), v: venue.court_count ?? 1 },
      ].map(({ k, v }) => <div key={k} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-xl font-semibold">{v}</dd></div>)}
    </dl>
    <section className="space-y-2"><h3 className="text-sm font-semibold">{t("sa_location")}</h3><Details row={{
      "Location": location,
      Address: venue.address || notSet,
      "Rented school / owner": venue.school_name || notSet,
    }} /></section>
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("sa_contact_person")}</h3>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{venue.contact_person || notSet}</span>
        <span className="break-all text-muted-foreground" dir="ltr">{venue.contact_phone || notSet}</span>
      </div>
    </section>
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("sa_unavail_title")}</h3>
      {slots.length === 0 && <p className="text-sm text-muted-foreground">{t("sa_unavail_empty")}</p>}
      <ul className="space-y-1.5 text-sm">
        {slots.map((slot, i) => <li key={i} className="flex items-center gap-1.5 rounded bg-destructive/10 p-2 text-destructive"><Ban className="h-3.5 w-3.5 shrink-0" />{formatBlockedSlot(slot, d => t(`avail_day_${d}` as keyof Dict))}</li>)}
      </ul>
    </section>
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("sa_wh_title")}</h3>
      {workingHours.length === 0 && <p className="text-sm text-muted-foreground">{t("sa_wh_empty")}</p>}
      <ul className="space-y-1.5 text-sm">
        {workingHours.map((slot, i) => <li key={i} className="flex items-center gap-1.5 rounded bg-primary/10 p-2 text-primary"><Clock className="h-3.5 w-3.5 shrink-0" />{formatBlockedSlot(slot, d => t(`avail_day_${d}` as keyof Dict))}</li>)}
      </ul>
    </section>
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("sa_map")}</h3>
      {coords
        ? <DirectionsLinks lat={coords.lat} lng={coords.lng} query={venue.name} />
        : <p className="text-sm text-muted-foreground">{t("sa_map_missing")}</p>}
      {venue.location_link && <p className="break-all text-xs text-muted-foreground" dir="ltr">{venue.location_link}</p>}
    </section>
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-semibold">{t("sa_rental_history")} ({rentals.length})</summary>
      <div className="mt-3 space-y-2">
        {rentals.length === 0 && <p className="text-sm text-muted-foreground">{t("sa_no_rentals")}</p>}
        {rentals.map(rental => <div key={rental.id} className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{rental.rental_date} · {rental.start_time.slice(0, 5)} · {rental.hours} {t("sa_records_hours")} · {formatMoney(rental.price, lang)}</p>
          <p className="break-words text-muted-foreground">{rental.customer_name}{rental.customer_phone ? ` · ${rental.customer_phone}` : ""} · {rental.is_paid ? t("sa_records_paid") : t("sa_records_unpaid")}</p>
        </div>)}
      </div>
    </details>
    <p className="text-xs text-muted-foreground">{t("sa_record_id")} <span className="break-all font-mono" dir="ltr">{venue.id}</span></p>
  </div>;
}
function Details({ row }: { row: Row }) {
  const { t } = useI18n();
  const labelOf = (key: string) => {
    const mapped = ROW_LABELS[key];
    if (mapped) return t(mapped);
    return key.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
  };
  return <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(row).map(([key, value]) => <div key={key} className="min-w-0 rounded-lg bg-muted/40 p-3"><dt className="text-xs capitalize text-muted-foreground">{labelOf(key)}</dt><dd className="mt-1 break-words text-sm">{value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>;
}
function AcademyMemberRow({ member }: { member: Row }) {
  const { t } = useI18n();
  const blocked = member.banned_until && new Date(member.banned_until) > new Date();
  const status = blocked ? t("sa_blocked") : member.is_active ? t("sa_active") : t("sa_inactive");
  return <details className="rounded-lg border px-3 py-2">
    <summary className="cursor-pointer text-sm marker:text-muted-foreground">
      <span className="inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 align-middle">
        <ProfileAvatar name={member.name ?? ""} url={member.avatar_url} className="h-7 w-7 shrink-0" />
        <span className="truncate font-medium">{member.name || t("sa_unnamed_member")}</span>
        {member.username && <span className="shrink-0 text-xs text-muted-foreground">@{member.username}</span>}
        <span className="shrink-0 text-xs text-muted-foreground">{status}</span>
      </span>
    </summary>
    <div className="pt-3"><Details row={{
      Email: member.email || t("sa_no_login"),
      Phone: member.phone || t("sa_not_provided"),
      Membership: member.membership_type === "half" ? t("sa_half") : t("sa_full"),
      "Platform plan": member.member_plan === "premium" ? t("sa_premium") : t("sa_free"),
      "Subscription sessions": member.subscription_sessions,
      "Sessions attended": member.sessions_attended,
    }} /></div>
  </details>;
}
function AcademyDetails({ academy, data }: { academy: Row; data: Records }) {
  const { t } = useI18n();
  const people = data.profiles.filter(row => row.academy_id === academy.id);
  const members = people.filter(row => row.role === "member");
  const admins = people.filter(row => row.role === "admin");
  const branches = data.academy_branches.filter(row => row.academy_id === academy.id);
  const plans = data.membership_plans.filter(row => row.academy_id === academy.id);
  const venues = data.venues.filter(row => row.academy_id === academy.id);
  const planName = ({ starter: t("sa_free"), plus: t("sa_free"), elite: t("sa_premium") } as Record<string, string>)[academy.plan] ?? t("sa_not_set");
  const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : t("sa_not_set");
  const trialExpired = academy.trial_ends_at && new Date(academy.trial_ends_at) < new Date();
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2 text-xs">{[planName, academy.is_trial ? trialExpired ? t("sa_trial_expired") : t("sa_trial") : t("sa_non_trial"), academy.is_public ? t("sa_public_listing") : t("sa_private_listing")].map(label => <span key={label} className="rounded-full bg-muted px-3 py-1 font-medium">{label}</span>)}</div>
    {academy.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{academy.description}</p>}
    <dl className="grid grid-cols-3 gap-2 text-center">{[{ k: t("sa_members"), v: members.length }, { k: t("sa_branches"), v: branches.length }, { k: t("sa_playgrounds"), v: venues.length }].map(({ k, v }) => <div key={k} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-xl font-semibold">{v}</dd></div>)}</dl>
    <section className="space-y-2"><h3 className="text-sm font-semibold">{t("sa_location")}</h3><Details row={{ Country: academy.country || t("sa_not_provided"), Governorate: academy.governorate || t("sa_not_provided"), "City / area": academy.area || t("sa_not_provided"), Address: academy.address || t("sa_not_provided") }} /></section>
    <section className="space-y-2"><h3 className="text-sm font-semibold">{t("sa_subscription_settings")}</h3><Details row={{ "Academy plan": planName, Created: date(academy.created_at), ...(academy.is_trial ? { "Trial ends": date(academy.trial_ends_at) } : {}), "Session bookings": academy.session_booking_enabled ? t("sa_enabled") : t("sa_inactive"), ...(academy.session_booking_enabled ? { "Platform fee": `${academy.platform_fee_percent ?? 5}%` } : {}) }} /></section>
    <section className="space-y-2"><h3 className="text-sm font-semibold">{t("sa_academy_admins")}</h3>{admins.length ? admins.map(admin => <div key={admin.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{admin.name}</p><p className="break-all text-muted-foreground">{admin.email}</p>{admin.phone && <p className="text-muted-foreground" dir="ltr">{admin.phone}</p>}</div>) : <p className="text-sm text-muted-foreground">{t("sa_no_admin")}</p>}</section>
    <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">{t("sa_members")} ({members.length})</summary><div className="mt-3 space-y-2">{members.length ? members.map(member => <AcademyMemberRow key={member.id} member={member} />) : <p className="text-sm text-muted-foreground">{t("sa_no_members")}</p>}</div></details>
    {[
      { label: t("sa_branches"), rows: branches, fields: (row: Row) => ({ Address: row.address || t("sa_not_provided"), Location: [row.country, row.governorate, row.area].filter(Boolean).join(" · ") || t("sa_not_provided"), Phone: row.phone || t("sa_not_provided"), "Main branch": row.is_main ? t("sa_active") : t("sa_inactive") }) },
      { label: t("sa_membership_plans"), rows: plans, fields: (row: Row) => ({ Sessions: row.sessions_count, "Price (EGP)": row.price ?? t("sa_not_set"), Status: row.is_active ? t("sa_active") : t("sa_inactive") }) },
      { label: t("sa_playgrounds"), rows: venues, fields: (row: Row) => ({ Capacity: row.capacity ?? t("sa_not_set"), "Rental cost (EGP / hour)": row.rental_cost ?? t("sa_not_set"), "Rental hours": row.rental_hours ?? t("sa_not_set") }) },
    ].map(group => <details key={group.label} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">{group.label} ({group.rows.length})</summary><div className="mt-3 space-y-2">{group.rows.length ? group.rows.map(row => <details key={row.id} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{row.name}</summary><div className="mt-3"><Details row={group.fields(row)} /></div></details>) : <p className="text-sm text-muted-foreground">{t("sa_none_added")}</p>}</div></details>)}
  </div>;
}
function MemberDetails({ member, data }: { member: Row; data: Records }) {
  const { t } = useI18n();
  const payments = data.payments.filter(r => r.member_id === member.id).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const attendance = data.attendance.filter(r => r.member_id === member.id);
  const games = data.friendly_game_participants.filter(r => r.member_id === member.id);
  const blocked = member.banned_until && new Date(member.banned_until) > new Date();
  const summary = {
    Email: member.email || (member.guardian_id ? t("sa_no_login") : t("sa_not_provided")),
    Phone: member.phone || t("sa_not_provided"),
    Academy: data.academies.find(a => a.id === member.academy_id)?.name ?? t("sa_independent"),
    "Account status": blocked ? t("sa_blocked") : t("sa_enabled"),
    "Membership status": member.is_active ? t("sa_active") : t("sa_inactive"),
    "Membership type": member.membership_type === "half" ? t("sa_half") : t("sa_full"),
    "Platform plan": member.member_plan === "premium" ? t("sa_premium") : t("sa_free"),
    "Subscription sessions": member.subscription_sessions,
    "Sessions attended": member.sessions_attended,
    Joined: member.join_date ?? member.created_at?.slice(0, 10) ?? t("sa_unknown"),
    ...(member.member_plan === "premium" ? { "Premium expires": member.premium_expires_at?.slice(0, 10) ?? t("sa_no_expiry") } : {}),
  };
  return <div className="space-y-5">
    <Details row={summary} />
    <details><summary className="cursor-pointer font-medium">{t("sa_payment_history")} ({payments.length})</summary>
      <div className="mt-3 space-y-2">{payments.length === 0 && <p className="text-sm text-muted-foreground">{t("sa_no_payments")}</p>}{payments.map(payment => <div key={payment.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{payment.payment_date} · {payment.amount} · {String(payment.method ?? "").replaceAll("_", " ")}</p><p className="text-muted-foreground">{payment.subscription_sessions} {t("sa_records_sessions")}{payment.notes ? ` · ${payment.notes}` : ""}</p></div>)}</div>
    </details>
    <details><summary className="cursor-pointer font-medium">{t("sa_activity")} ({attendance.filter(r => r.is_present).length} / {attendance.length})</summary>
      <div className="mt-3 space-y-2 text-sm">{attendance.length === 0 && games.length === 0 && <p className="text-muted-foreground">{t("sa_no_activity")}</p>}{attendance.map(record => {
        const session = data.training_sessions.find(item => item.id === record.session_id);
        return <p key={record.id} className="rounded-lg border p-3">{session?.date ?? t("sa_unknown_date")} · {t("sa_training")} · {record.is_present ? t("sa_attended") : t("sa_absent")}</p>;
      })}{games.map(record => {
        const game = data.friendly_games.find(item => item.id === record.game_id);
        return <p key={record.id} className="rounded-lg border p-3">{game?.game_date ?? t("sa_unknown_date")} · {game?.title ?? t("sa_friendly_game")} · {record.is_waitlisted ? t("sa_waitlisted") : record.role === "organizer" ? t("sa_organizer") : t("sa_player")}</p>;
      })}</div>
    </details>
  </div>;
}
export function PlatformRecords() {
  const { t } = useI18n();
  const cache = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabs = [
    { value: "Members", label: t("sa_records_members") },
    { value: "Academies", label: t("sa_records_academies") },
    { value: "Friendly games", label: t("sa_records_games") },
    { value: "Tournaments", label: t("sa_records_tournaments") },
    { value: "Playgrounds", label: t("sa_records_playgrounds") },
  ] as const;
  const { data, isLoading, error, refetch } = useQuery<Records>({ queryKey: ["platform-records"], queryFn: async () => {
    const response = await fetch("/api/platform-admin", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  } });
  const [tab, setTab] = useState<(typeof tabs)[number]["value"]>("Members");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`);
  const [selected, setSelected] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingVenue, setDeletingVenue] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [editingAcademy, setEditingAcademy] = useState<Academy | null>(null);
  const [editingVenue, setEditingVenue] = useState<VenueDraft | null>(null);
  const [deletingAcademy, setDeletingAcademy] = useState<Academy | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const removeAcademy = useSuperAdminDeleteAcademy();
  const requestedTab = searchParams.get("tab");
  useEffect(() => {
    setTab(tabs.find(item => item.value === requestedTab)?.value ?? "Members");
    setSearch("");
    setSelected(null);
    setEditingAcademy(null);
    setDeletingAcademy(null);
    setDeletingVenue(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab]);
  const act = async (body: Row) => {
    setBusy(true);
    try {
      const response = await fetch("/api/platform-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success(body.action === "venue" ? t("sa_playground_updated") : body.action === "delete_venue" ? t("sa_playground_deleted") : body.action === "delete" ? t("sa_account_deleted") : t("sa_account_updated"));
      if (body.action === "venue") setEditingVenue(null);
      setEditing(null); setDeleting(null); setDeletingVenue(null); setConfirmation("");
      await cache.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("sa_action_failed")); }
    finally { setBusy(false); }
  };
  const dialogDescription = tab === "Members" ? t("sa_records_detail_member")
    : tab === "Academies" ? t("sa_records_detail_academy")
    : tab === "Playgrounds" ? t("sa_records_detail_venue")
    : t("sa_records_detail_other");
  if (error || !data) return <Card><CardContent className="p-6"><p role="alert">{error?.message ?? t("sa_could_not_load")}</p><Button onClick={() => refetch()}>{t("sa_retry")}</Button></CardContent></Card>;
  const sports = (data.sports ?? []).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }));
  const sportById = new Map(sports.map((s) => [s.id, s.name]));
  const editingVenueCoords = editingVenue ? parseMapsCoordinates(editingVenue.location_link ?? "") : null;
  const academy = (id: string) => data.academies.find(a => a.id === id)?.name ?? (id ? t("sa_academy_unavailable") : t("sa_independent"));
  const source = tab === "Members" ? data.profiles : tab === "Academies" ? data.academies : tab === "Friendly games" ? data.friendly_games : tab === "Tournaments" ? data.tournaments : data.venues;
  const academyContacts = new Map<string, { fields: unknown[]; phones: unknown[] }>();
  if (tab === "Academies") {
    for (const person of data.profiles) {
      if (person.role !== "admin" || !person.academy_id) continue;
      const contact = academyContacts.get(person.academy_id) ?? { fields: [], phones: [] };
      contact.fields.push(person.name, person.email, person.account_email, person.phone);
      contact.phones.push(person.phone);
      academyContacts.set(person.academy_id, contact);
    }
    for (const branch of data.academy_branches) {
      const contact = academyContacts.get(branch.academy_id) ?? { fields: [], phones: [] };
      contact.fields.push(branch.phone);
      contact.phones.push(branch.phone);
      academyContacts.set(branch.academy_id, contact);
    }
  }
  const rows = source.filter(row => {
    const contacts = tab === "Academies" ? academyContacts.get(row.id) : undefined;
    return matchesAdminSearch(search,
      [row.name, row.email, row.account_email, row.title, row.phone, row.id,
        ...(tab === "Academies" ? contacts?.fields ?? [] : [academy(row.academy_id)])],
      [row.phone, ...(contacts?.phones ?? [])]);
  });
  const searchLabel = tab === "Members" ? t("sa_records_search_members")
    : tab === "Academies" ? t("sa_records_search_academies")
    : t("sa_records_search_general");
  const related = selected ? (tab === "Members" ? { Payments: data.payments.filter(r => r.member_id === selected.id), Attendance: data.attendance.filter(r => r.member_id === selected.id), Games: data.friendly_game_participants.filter(r => r.member_id === selected.id) } : tab === "Academies" ? { [t("sa_members")]: data.profiles.filter(r => r.academy_id === selected.id), [t("sa_branches")]: data.academy_branches.filter(r => r.academy_id === selected.id), [t("sa_membership_plans")]: data.membership_plans.filter(r => r.academy_id === selected.id), [t("sa_playgrounds")]: data.venues.filter(r => r.academy_id === selected.id) } : tab === "Friendly games" ? { Participants: data.friendly_game_participants.filter(r => r.game_id === selected.id).map(r => ({ ...r, name: data.profiles.find(p => p.id === r.member_id)?.name })) } : tab === "Tournaments" ? {
    [t("sa_records_teams")]: data.tournament_teams.filter(r => r.tournament_id === selected.id).map(r => ({ id: r.id, name: r.name, players: data.tournament_team_members.filter(m => m.team_id === r.id).length })),
    [t("sa_records_participants")]: data.tournament_participants.filter(r => r.tournament_id === selected.id).map(r => ({ id: r.id, member: data.profiles.find(p => p.id === r.member_id)?.name ?? r.member_id })),
    [t("sa_records_matches")]: data.tournament_matches.filter(r => r.tournament_id === selected.id).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)).map(r => ({ id: r.id, round: r.round_name, matchup: `${data.tournament_teams.find(x => x.id === r.team_a_id)?.name ?? "TBD"} vs ${data.tournament_teams.find(x => x.id === r.team_b_id)?.name ?? "TBD"}`, score: r.score_a != null ? `${r.score_a} – ${r.score_b}` : "—", status: r.status })),
  } : {}) : {};
  return <Card>
    <CardHeader><CardTitle>{t("sa_records_title")}</CardTitle><p className="text-sm text-muted-foreground">{t("sa_records_counts").replace("{accounts}", String(data.profiles.length)).replace("{academies}", String(data.academies.length)).replace("{games}", String(data.friendly_games.length)).replace("{playgrounds}", String(data.venues.length))}</p></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("sa_records_title")}>{tabs.map(item => <Button key={item.value} role="tab" aria-selected={tab === item.value} variant={tab === item.value ? "default" : "outline"} onClick={() => { router.push(`/admin?tab=${encodeURIComponent(item.value)}`, { scroll: false }); }}>{item.label}</Button>)}</div>
      <div className="flex flex-wrap gap-2"><Input className="max-w-sm" type="search" aria-label={searchLabel} placeholder={`${searchLabel}…`} value={search} onChange={e => setSearch(e.target.value)} />{tab === "Playgrounds" && <Input className="w-auto" type="date" aria-label={t("sa_records_schedule_date")} value={date} onChange={e => setDate(e.target.value)} />}{tab === "Playgrounds" && <Button disabled={busy} onClick={() => setEditingVenue({ name: "", capacity: "", sport_id: null, school_name: "", rental_cost: "", rental_hours: "1", location_link: "", country: "", governorate: "", area: "", contact_person: "", contact_phone: "", lat: "", lng: "", academy_id: null, court_count: "1", unavailable_slots: [], working_hours: [] })}><Plus className="mr-1 h-4 w-4 rtl:ml-1 rtl:mr-0" />{t("sa_records_add_playground")}</Button>}<Button variant="outline" onClick={() => refetch()}>{t("sa_records_refresh")}</Button></div>
      {tab === "Playgrounds" && <p className="text-sm text-muted-foreground">{t("sa_records_schedule_note")}</p>}
      <p className="text-xs text-muted-foreground">{t("sa_records_results").replace("{shown}", String(rows.length)).replace("{total}", String(source.length))}</p>
      <div className="max-h-[650px] space-y-3 overflow-auto">
      {rows.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("sa_records_empty")}</p>}
      {rows.map(row => {
        const blocked = row.banned_until && new Date(row.banned_until) > new Date();
        const protectedAccount = row.email?.toLowerCase() === PLATFORM_ADMIN_EMAIL;
        const rentals = data.venue_rentals.filter(r => r.venue_id === row.id && r.rental_date === date);
        const events = [...rentals.map(r => ({ time: r.start_time, label: `${t("sa_rental")} · ${r.customer_name} · ${r.hours} ${t("sa_records_hours")} · ${r.is_paid ? t("sa_records_paid") : t("sa_records_unpaid")}` })), ...data.training_sessions.filter(r => r.venue_id === row.id && r.date === date && r.status !== "canceled").map(r => ({ time: r.time, label: `${t("sa_training")} · ${t(STATUS_LABELS[r.status] ?? "sa_records_scheduled")} · ${t("sa_records_end_time_unknown")}` })), ...data.tournament_matches.filter(r => r.venue_id === row.id && r.match_date === date && r.status !== "canceled").map(r => ({ time: r.match_time ?? "", label: `${t("sa_tournament")} · ${r.round_name} · ${t("sa_records_end_time_unknown")}` }))].sort((a,b) => a.time.localeCompare(b.time));
        const blockedToday = ((row.unavailable_slots ?? []) as VenueUnavailableSlot[]).filter(s => weekdayOf(date) === s.weekday);
        const dayClosed = [...blockedIntervalsForDate((row.unavailable_slots ?? []) as VenueUnavailableSlot[], date), ...closedIntervalsFromWorkingHours((row.working_hours ?? []) as VenueUnavailableSlot[], date)];
        const { occupied, gaps } = rentalCoverage(data.venue_rentals.filter(r => r.venue_id === row.id) as RentalInterval[], date, dayClosed);
        return <article key={row.id} className="rounded-xl border p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              {tab === "Members" && <ProfileAvatar name={row.name ?? ""} url={row.avatar_url} className="h-10 w-10 shrink-0" />}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words font-semibold">{row.name ?? row.title}</h3>
                  {tab === "Members" && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${blocked ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{blocked ? t("sa_blocked") : t("sa_enabled")}</span>}
                  {row.guardian_id && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t("sa_family_member")}</span>}
                </div>
                {tab === "Members" ? (row.email ? <p className="mt-1 break-all text-sm text-muted-foreground">{row.email}</p> : <p className="mt-1 text-xs text-muted-foreground">{t("sa_no_login")}</p>) : <p className="text-sm text-muted-foreground">{tab === "Academies" ? `${row.plan} · ${row.is_trial ? t("sa_trial") : t("sa_records_paid")} · ${data.profiles.filter(p => p.academy_id === row.id).length} ${t("sa_records_accounts")}` : tab === "Friendly games" ? `${row.game_date} ${row.start_time} · ${row.sport} · ${row.status} · ${data.friendly_game_participants.filter(p => p.game_id === row.id && !p.is_waitlisted).length}/${row.max_players} ${t("sa_records_players")}` : tab === "Tournaments" ? `${academy(row.academy_id)} · ${row.format ?? "—"} · ${row.status} · ${data.tournament_matches.filter(m => m.tournament_id === row.id).length} ${t("sa_records_matches_short")}` : `${academy(row.academy_id)} · ${[row.governorate, row.area].filter(Boolean).join(" · ") || t("sa_no_address")}`}</p>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setSelected(row)}>{t("sa_records_details")}</Button>{tab === "Members" && <><Button size="sm" variant="outline" disabled={busy || protectedAccount} onClick={() => setEditing({ ...row })}>{t("sa_records_membership")}</Button><Button size="sm" variant="outline" disabled={busy || protectedAccount} onClick={() => act({ action: "block", id: row.id, blocked: !blocked })}>{blocked ? t("sa_records_unblock") : t("sa_records_block")}</Button><Button size="sm" variant="destructive" disabled={busy || protectedAccount} onClick={() => { setDeleting(row); setConfirmation(""); }}>{t("sa_records_delete")}</Button></>}{tab === "Academies" && <><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingAcademy(row as Academy)}>{t("sa_records_edit")}</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { setDeletingAcademy(row as Academy); setConfirmation(""); }}>{t("sa_records_delete")}</Button></>}          {tab === "Playgrounds" && <><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingVenue({ ...row, lat: row.lat ? String(row.lat) : "", lng: row.lng ? String(row.lng) : "" })}>{t("sa_records_edit")}</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { setDeletingVenue(row); setConfirmation(""); }}>{t("sa_records_delete")}</Button></>}</div></div>
          {tab === "Members" && <dl className="grid grid-cols-1 gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t("sa_academy")}</dt><dd className="mt-1 break-words font-medium">{academy(row.academy_id)}</dd><dd className="text-xs text-muted-foreground">{row.academy_id ? row.is_active ? t("sa_active_membership") : t("sa_pending_membership") : t("sa_not_joined")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("sa_platform_plan")}</dt><dd className="mt-1 font-medium">{row.member_plan === "premium" ? t("sa_premium") : t("sa_free")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("sa_academy_subscription")}</dt><dd className="mt-1 font-medium">{row.academy_id && row.subscription_sessions > 0 ? `${row.membership_type === "half" ? t("sa_half") : t("sa_full")} · ${row.subscription_sessions} ${t("sa_records_sessions")}` : t("sa_no_subscription")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("sa_sessions_attended")}</dt><dd className="mt-1 font-medium">{row.sessions_attended ?? 0}</dd></div>
          </dl>}
          {tab === "Playgrounds" && <div className="space-y-2 text-sm"><p className="font-medium">{t("sa_records_rental_hours_today").replace("{hours}", (occupied / 60).toFixed(1)).replace("{percent}", String(Math.round(occupied / 1440 * 100)))}</p>{events.map((event,i) => <p key={i} className="rounded bg-muted p-2">{event.time.slice(0,5) || t("sa_records_time_unknown")} · {event.label}</p>)}{blockedToday.map((slot,i) => <p key={`blocked-${i}`} className="flex items-center gap-1.5 rounded bg-destructive/10 p-2 text-destructive"><Ban className="h-3.5 w-3.5" />{t("sa_records_blocked_slot").replace("{slot}", formatBlockedSlot(slot, d => t(`avail_day_${d}` as keyof Dict)))}</p>)}{events.length === 0 && blockedToday.length === 0 && <p>{t("sa_records_no_bookings")}</p>}<p className="text-muted-foreground">{t("sa_records_rental_gaps").replace("{gaps}", gaps.join(", ") || t("sa_records_none_gaps"))}</p></div>}
        </article>;
      })}</div>
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.name ?? selected?.title ?? t("sa_records_record_details")}</DialogTitle><DialogDescription>{dialogDescription}</DialogDescription></DialogHeader>{selected && (tab === "Members" ? <MemberDetails member={selected} data={data} /> : tab === "Academies" ? <AcademyDetails academy={selected} data={data} /> : tab === "Playgrounds" ? <VenueDetails venue={selected} data={data} /> : <Details row={selected} />)}{tab !== "Members" && tab !== "Academies" && Object.entries(related).map(([label, records]) => <details key={label}><summary className="cursor-pointer font-medium">{label} ({records?.length ?? 0})</summary><div className="space-y-4 py-3">{records?.map((r: Row) => label === "Participants" ? <AcademyMemberRow key={r.id} member={r} /> : <Details key={r.id} row={r} />)}</div></details>)}</DialogContent></Dialog>
      <Dialog open={!!editing} onOpenChange={open => !busy && !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>{t("sa_edit_membership")}</DialogTitle><DialogDescription>{editing?.name} · {editing?.email}</DialogDescription></DialogHeader>{editing && <form className="space-y-4" onSubmit={e => { e.preventDefault(); act({ action: "membership", id: editing.id, membership_type: editing.membership_type, subscription_sessions: Number(editing.subscription_sessions), member_plan: editing.member_plan, premium_expires_at: editing.premium_expires_at ? new Date(editing.premium_expires_at).toISOString() : null, is_active: editing.is_active }); }}>
        <label className="block text-sm">{t("sa_academy_membership")}<select className="mt-1 w-full rounded border bg-background p-2" value={editing.membership_type} onChange={e => setEditing({ ...editing, membership_type: e.target.value })}><option value="full">{t("sa_full")}</option><option value="half">{t("sa_half")}</option></select></label>
        <label className="block text-sm">{t("sa_subscription_sessions")}<Input type="number" min="0" max="10000" required value={editing.subscription_sessions} onChange={e => setEditing({ ...editing, subscription_sessions: e.target.value })} /></label>
        <label className="block text-sm">{t("sa_platform_plan")}<select className="mt-1 w-full rounded border bg-background p-2" value={editing.member_plan} onChange={e => setEditing({ ...editing, member_plan: e.target.value })}><option value="free">{t("sa_free")}</option><option value="premium">{t("sa_premium")}</option></select></label>
        <label className="block text-sm">{t("sa_premium_expiry_label")}<Input type="date" value={editing.premium_expires_at?.slice(0,10) ?? ""} onChange={e => setEditing({ ...editing, premium_expires_at: e.target.value })} /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />{t("sa_active_membership_label")}</label>
        <Button type="submit" disabled={busy}>{busy ? t("sa_saving") : t("sa_save_membership")}</Button>
      </form>}</DialogContent></Dialog>
      <Dialog open={!!deleting} onOpenChange={open => !busy && !open && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>{t("sa_delete_account_title")}</DialogTitle><DialogDescription>{t("sa_delete_account_body").replace("{phrase}", confirmPhrase(deleting) ?? "")}</DialogDescription></DialogHeader><Input aria-label={t("sa_confirmation")} value={confirmation} onChange={e => setConfirmation(e.target.value)} /><Button variant="destructive" disabled={busy || !confirmMatches(confirmation, deleting)} onClick={() => act({ action: "delete", id: deleting!.id, confirmation })}>{busy ? t("sa_deleting") : t("sa_permanently_delete")}</Button></DialogContent></Dialog>
      <AlertDialog open={!!deletingAcademy} onOpenChange={open => !removeAcademy.isPending && !open && setDeletingAcademy(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("sa_delete_academy_title")}</AlertDialogTitle><AlertDialogDescription>{t("sa_delete_academy_body").replace("{name}", deletingAcademy?.name ?? "")}</AlertDialogDescription></AlertDialogHeader><Input aria-label={t("sa_academy")} value={confirmation} onChange={e => setConfirmation(e.target.value)} /><AlertDialogFooter><AlertDialogCancel disabled={removeAcademy.isPending}>{t("sa_cancel")}</AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" disabled={removeAcademy.isPending || confirmation !== deletingAcademy?.name} onClick={async () => { try { await removeAcademy.mutateAsync(deletingAcademy!.id); toast.success(t("sa_academy_deleted")); setDeletingAcademy(null); setConfirmation(""); await cache.invalidateQueries(); } catch (e) { toast.error(e instanceof Error ? e.message : t("sa_deletion_failed")); } }}>{removeAcademy.isPending ? t("sa_deleting") : t("sa_permanently_delete")}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AcademyEditDialog academy={editingAcademy} onClose={() => setEditingAcademy(null)} onDeleted={() => { setEditingAcademy(null); cache.invalidateQueries(); }} />
      <Dialog open={!!editingVenue} onOpenChange={open => !busy && !open && setEditingVenue(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editingVenue?.id ? t("sa_edit_playground") : t("sa_add_playground")}</DialogTitle><DialogDescription>{editingVenue?.id ? editingVenue.name : t("sa_add_playground_desc")}</DialogDescription></DialogHeader>{editingVenue && <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!isValidSlotList(editingVenue.unavailable_slots)) { toast.error(t("sa_unavail_invalid")); return; } if (!isValidSlotList(editingVenue.working_hours)) { toast.error(t("sa_wh_invalid")); return; } act({ action: "venue", ...(editingVenue.id ? { id: editingVenue.id } : {}), academy_id: editingVenue.academy_id ?? null, name: editingVenue.name, capacity: editingVenue.capacity, sport_id: editingVenue.sport_id ?? "", school_name: editingVenue.school_name, rental_cost: editingVenue.rental_cost, rental_hours: editingVenue.rental_hours, location_link: editingVenue.location_link, lat: editingVenue.lat, lng: editingVenue.lng, country: editingVenue.country, governorate: editingVenue.governorate, city: editingVenue.area, contact_person: editingVenue.contact_person, contact_phone: editingVenue.contact_phone, court_count: Number(editingVenue.court_count) || 1, unavailable_slots: ((editingVenue.unavailable_slots ?? []) as VenueUnavailableSlot[]).map(s => ({ weekday: Number(s.weekday), start: s.start, end: s.end })), working_hours: ((editingVenue.working_hours ?? []) as VenueUnavailableSlot[]).map(s => ({ weekday: Number(s.weekday), start: s.start, end: s.end })) }); }}>
        <label className="block text-sm">{t("sa_academy")}
          <select className="mt-1 w-full rounded border bg-background p-2" value={editingVenue.academy_id ?? ""} onChange={e => setEditingVenue({ ...editingVenue, academy_id: e.target.value || null })}>
            <option value="">{t("sa_unassigned")}</option>
            {data.academies.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">{t("sa_pool_hint")}</span>
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("sa_playground_name")}</Label>
            <Input required value={editingVenue.name} onChange={e => setEditingVenue({ ...editingVenue, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("sa_sport")}</Label>
            <Input
              list="sa-sport-options"
              value={editingVenue.sport_id && sportById.has(editingVenue.sport_id) ? (sportById.get(editingVenue.sport_id) as string) : ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                const found = sports.find((s) => s.name.toLowerCase() === raw.toLowerCase());
                setEditingVenue((current) => current && ({ ...current, sport_id: raw === "" ? null : found ? found.id : current.sport_id }));
              }}
              placeholder={t("sa_sport_search")}
            />
            <datalist id="sa-sport-options">{sports.map((s) => <option key={s.id} value={s.name} />)}</datalist>
            <span className="mt-1 block text-xs text-muted-foreground">{t("sa_sport_search_hint")}</span>
          </div>
        </div>
          <div className="space-y-2">
            <Label>{t("sa_location_link")}</Label>
            <Input dir="ltr" value={editingVenue.location_link ?? ""} onChange={e => { const value = e.target.value; const coords = parseMapsCoordinates(value); setEditingVenue((current) => current && ({ ...current, location_link: value, lat: coords ? String(coords.lat) : current.lat, lng: coords ? String(coords.lng) : current.lng })); }} placeholder={t("sa_location_link_placeholder")} />
            <span className="mt-1 block text-xs text-muted-foreground">{t("sa_location_link_hint")}</span>
            {editingVenueCoords && <span className="mt-1 block text-xs font-medium text-primary">{t("sa_location_link_detected").replace("{coords}", `${editingVenueCoords.lat.toFixed(5)}, ${editingVenueCoords.lng.toFixed(5)}`)}</span>}
          </div>
         <LocationFields
           country={editingVenue.country ?? ""}
           governorate={editingVenue.governorate ?? ""}
           city={editingVenue.area ?? ""}
           onCountryChange={(v) => setEditingVenue((current) => current && ({ ...current, country: v, governorate: "", area: "" }))}
           onGovernorateChange={(v) => setEditingVenue((current) => current && ({ ...current, governorate: v, area: "" }))}
           onCityChange={(v) => setEditingVenue((current) => current && ({ ...current, area: v }))}
           governorateLabel={t("sa_form_governorate")}
           cityLabel={t("sa_form_area")}
         />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("sa_capacity")}</Label>
            <Input type="number" min="0" value={editingVenue.capacity ?? ""} onChange={e => setEditingVenue({ ...editingVenue, capacity: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("sa_rented_school")}</Label>
            <Input value={editingVenue.school_name ?? ""} onChange={e => setEditingVenue({ ...editingVenue, school_name: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("sa_rental_cost")}</Label>
            <Input type="number" min="0" step="0.01" value={editingVenue.rental_cost ?? ""} onChange={e => setEditingVenue({ ...editingVenue, rental_cost: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("sa_rental_hours")}</Label>
            <Input type="number" min="0" step="0.5" value={editingVenue.rental_hours ?? "1"} onChange={e => setEditingVenue({ ...editingVenue, rental_hours: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("sa_court_count")}</Label>
            <Input type="number" min="1" step="1" value={editingVenue.court_count ?? "1"} onChange={e => setEditingVenue({ ...editingVenue, court_count: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("sa_contact_person")}</Label>
            <Input value={editingVenue.contact_person ?? ""} onChange={e => setEditingVenue({ ...editingVenue, contact_person: e.target.value })} placeholder={t("sa_contact_person_placeholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("sa_contact_phone")}</Label>
            <Input value={editingVenue.contact_phone ?? ""} onChange={e => setEditingVenue({ ...editingVenue, contact_phone: e.target.value })} placeholder={t("sa_contact_phone_placeholder")} />
          </div>
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Ban className="h-4 w-4 text-destructive" />{t("sa_unavail_title")}</p>
          <p className="text-xs text-muted-foreground">{t("sa_unavail_desc")}</p>
          {(editingVenue.unavailable_slots ?? []).length === 0 && <p className="text-xs text-muted-foreground">{t("sa_unavail_empty")}</p>}
          {(editingVenue.unavailable_slots ?? []).map((slot, idx) => (
            <div key={idx} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2">
              <select aria-label={t("sa_unavail_day")} className="rounded border bg-background p-2 text-sm" value={String(slot.weekday)} onChange={e => setEditingVenue(c => c ? ({ ...c, unavailable_slots: (c.unavailable_slots ?? []).map((s, i) => i === idx ? { ...s, weekday: Number(e.target.value) } : s) }) : c)}>
                {[0, 1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{t(`avail_day_${d}` as keyof Dict)}</option>)}
              </select>
              <Input aria-label={t("sa_unavail_start")} dir="ltr" type="time" className="p-1.5 text-sm" value={slot.start} onChange={e => setEditingVenue(c => c ? ({ ...c, unavailable_slots: (c.unavailable_slots ?? []).map((s, i) => i === idx ? { ...s, start: e.target.value } : s) }) : c)} />
              <Input aria-label={t("sa_unavail_end")} dir="ltr" type="time" className="p-1.5 text-sm" value={slot.end} onChange={e => setEditingVenue(c => c ? ({ ...c, unavailable_slots: (c.unavailable_slots ?? []).map((s, i) => i === idx ? { ...s, end: e.target.value } : s) }) : c)} />
              <Button type="button" variant="ghost" size="icon" aria-label={t("sa_unavail_remove")} onClick={() => setEditingVenue(c => c ? ({ ...c, unavailable_slots: (c.unavailable_slots ?? []).filter((_, i) => i !== idx) }) : c)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setEditingVenue(c => c ? ({ ...c, unavailable_slots: [...(c.unavailable_slots ?? []), { weekday: 0, start: "08:00", end: "10:00" }] }) : c)}><Plus className="mr-1 h-3.5 w-3.5 rtl:ml-1 rtl:mr-0" />{t("sa_unavail_add")}</Button>
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Clock className="h-4 w-4 text-primary" />{t("sa_wh_title")}</p>
          <p className="text-xs text-muted-foreground">{t("sa_wh_desc")}</p>
          {(editingVenue.working_hours ?? []).length === 0 && <p className="text-xs text-muted-foreground">{t("sa_wh_empty")}</p>}
          {(editingVenue.working_hours ?? []).map((slot, idx) => (
            <div key={idx} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2">
              <select aria-label={t("sa_unavail_day")} className="rounded border bg-background p-2 text-sm" value={String(slot.weekday)} onChange={e => setEditingVenue(c => c ? ({ ...c, working_hours: (c.working_hours ?? []).map((s, i) => i === idx ? { ...s, weekday: Number(e.target.value) } : s) }) : c)}>
                {[0, 1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{t(`avail_day_${d}` as keyof Dict)}</option>)}
              </select>
              <Input aria-label={t("sa_unavail_start")} dir="ltr" type="time" className="p-1.5 text-sm" value={slot.start} onChange={e => setEditingVenue(c => c ? ({ ...c, working_hours: (c.working_hours ?? []).map((s, i) => i === idx ? { ...s, start: e.target.value } : s) }) : c)} />
              <Input aria-label={t("sa_unavail_end")} dir="ltr" type="time" className="p-1.5 text-sm" value={slot.end} onChange={e => setEditingVenue(c => c ? ({ ...c, working_hours: (c.working_hours ?? []).map((s, i) => i === idx ? { ...s, end: e.target.value } : s) }) : c)} />
              <Button type="button" variant="ghost" size="icon" aria-label={t("sa_unavail_remove")} onClick={() => setEditingVenue(c => c ? ({ ...c, working_hours: (c.working_hours ?? []).filter((_, i) => i !== idx) }) : c)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setEditingVenue(c => c ? ({ ...c, working_hours: [...(c.working_hours ?? []), { weekday: 0, start: "08:00", end: "22:00" }] }) : c)}><Plus className="mr-1 h-3.5 w-3.5 rtl:ml-1 rtl:mr-0" />{t("sa_wh_add")}</Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setEditingVenue(null)}>{t("sa_cancel")}</Button>
          <Button type="submit" disabled={busy} className="ml-auto rtl:ml-0 rtl:mr-auto">{busy ? t("sa_saving") : t("sa_save_playground")}</Button>
        </div>
      </form>}</DialogContent></Dialog>
      <Dialog open={!!deletingVenue} onOpenChange={open => !busy && !open && setDeletingVenue(null)}><DialogContent><DialogHeader><DialogTitle>{t("sa_delete_playground_title")}</DialogTitle><DialogDescription>{t("sa_delete_playground_body").replace("{name}", deletingVenue?.name ?? "")}</DialogDescription></DialogHeader><Input aria-label={t("sa_playground_name")} value={confirmation} onChange={e => setConfirmation(e.target.value)} /><Button variant="destructive" disabled={busy || confirmation !== deletingVenue?.name} onClick={() => act({ action: "delete_venue", id: deletingVenue!.id, confirmation })}>{busy ? t("sa_deleting") : t("sa_permanently_delete")}</Button></DialogContent></Dialog>
    </CardContent>
  </Card>;
}