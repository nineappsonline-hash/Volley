"use client";
import { splitGameParticipants } from "@/lib/games/participants";
import { venueCardPhoto } from "@/lib/venue-media";
import { GameCardBackground } from "@/components/games/game-card-background";
import { SportIcon } from "@/components/marketing/sport-icons";
import { sportToSlug } from "@/lib/sport-slugs";
import { Users, Trophy, Sparkles, ShieldCheck, CalendarDays, CheckCircle2 } from "lucide-react";
import { MemberTrainingAssignment, ConfirmTrainingPayment, MemberAttendanceEdit } from "./member-training-assignment";
import { MemberDetailsEditor } from "./member-details-editor";
import { memberAge } from "@/lib/admin/member-details";
import { MemberFamilyManager } from "./member-family-manager";

import { CreateAcademyButton, AcademyTrainingManager } from "./academy-training-manager";
import { GameTeamsButton } from "@/components/games/game-teams";
import { GameBookingStatus } from "@/components/games/game-booking-status";
import { ParticipantPayment } from "./participant-payment";
import { AdminGameEditor } from "@/components/games/admin-game-editor";
import { SortedOptions } from "@/components/ui/sorted-options";
import { NativeSelect } from "@/components/ui/sorted-options";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { matchesAdminSearch } from "@/lib/admin-record-search";
import { rentalCoverage, type RentalInterval } from "@/lib/admin-schedule";
import { PLATFORM_ADMIN_EMAILS, matchesAccountEmail } from "@/lib/platform-admin";
import { useCancelFriendlyGame, useSuperAdminDeleteAcademy, useAdminAddGameMember, useAdminRemoveGameMember } from "@/lib/queries";
import type { Academy, VenueUnavailableSlot } from "@/lib/types";
import type { Dict } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n";
import { blockedIntervalsForDate, closedIntervalsFromWorkingHours, formatBlockedSlot, isValidSlotList, weekdayOf } from "@/lib/venue-slots";
import { parseMapsCoordinates } from "@/lib/maps";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { AcademyEditDialog } from "./academy-edit-dialog";
import { AcademyLogo, AcademyLogoDialog } from "@/components/academies/academy-logo";
import { TournamentFormDialog } from "@/components/tournaments/tournaments-client";
import { LocationFields } from "@/components/shared/location-fields";
import { Label } from "@/components/ui/label";
import { Ban, Camera, Check, ChevronDown, Clock, Copy, Loader2, Plus, Search, Star, Trash2, Upload, UserPlus, UserRoundX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { minutesOf } from "@/lib/venue-slots";
import { formatMoney, formatTime12h, formatHour12, getDefaultMinPlayers } from "@/lib/constants";
import { COMMUNITY_SPORTS } from "@/lib/constants";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { createClient } from "@/lib/supabase/client";
import { cn, errorMessage } from "@/lib/utils";
import { SITE_URL } from "@/lib/seo";

type Row = Record<string, any>;
type Records = Record<string, Row[]>;

/** Venue draft (create/edit dialog state) with a typed excluded-times list
 * and the weekly working-hours configuration. */
interface VenueDraft extends Row {
  unavailable_slots?: VenueUnavailableSlot[];
  working_hours?: VenueUnavailableSlot[];
  court_count?: string | number;
  /** Public URLs of the playground photos; the gallery order. */
  photos?: string[];
  /** Photography explicitly chosen as the card thumbnail (else the first photo). */
  cover_url?: string | null;
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

const GAME_STATUS_STYLES: Record<string, string> = {
  open: "bg-positive-100 text-success-ink ",
  full: "bg-attention-100 text-warning-ink ",
  completed: "bg-success/15 text-success-ink",
  cancelled: "bg-negative-100 text-error-ink ",
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
  const [copied, setCopied] = useState(false);
  const photos = (venue.photos ?? []) as string[];
  const cardPhoto = (venue.cover_url ?? photos[0] ?? null) as string | null;
  const [activePhoto, setActivePhoto] = useState(() => Math.max(0, cardPhoto ? photos.indexOf(cardPhoto) : 0));
  const copyLink = async () => {
    if (!venue.location_link) return;
    try {
      await navigator.clipboard.writeText(venue.location_link);
      setCopied(true);
      toast.success(t("cal_copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("common_error"));
    }
  };
  const notSet = t("sa_not_set");
  const sportName = data.sports.find(s => s.id === venue.sport_id)?.name;
  const academyName = venue.academy_id
    ? data.academies.find(a => a.id === venue.academy_id)?.name ?? t("sa_academy_unavailable")
    : t("sa_unassigned");
  const coords = typeof venue.lat === "number" && typeof venue.lng === "number"
    ? ({ lat: venue.lat, lng: venue.lng } as const)
    : parseMapsCoordinates(venue.location_link ?? "");
  const location = [venue.country, venue.governorate, venue.area, venue.address].filter(v => v && String(v).trim()).map(v => String(v).trim()).join(" · ") || notSet;
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
    {photos.length > 0 && (
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[activePhoto]} alt={venue.name} className="aspect-video w-full rounded-xl border object-cover" />
        {photos.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((url, idx) => (
              <button key={url} type="button" onClick={() => setActivePhoto(idx)} className={cn("relative h-14 w-20 overflow-hidden rounded-lg border", idx === activePhoto && "ring-2 ring-primary")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${venue.name} ${idx + 1}`} className="h-full w-full object-cover" />
                {url === cardPhoto && <span className="absolute start-0 top-0 rounded-br bg-background/80 px-1 py-0.5 text-[9px] font-semibold">{t("sa_photo_card")}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    )}
    <div className="flex flex-wrap gap-2 text-xs">
      {sportName && <span className="rounded-full bg-muted px-3 py-1 font-medium">{sportName}</span>}
      <span className="rounded-full bg-muted px-3 py-1 font-medium">{academyName}</span>
      {Number(venue.court_count) > 1 && <span className="rounded-full bg-muted px-3 py-1 font-medium">{venue.court_count} {t("rentals_courts_short")}</span>}
    </div>
    <dl className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
      {[
        { k: t("sa_capacity"), v: venue.capacity ?? notSet },
        { k: t("sa_rental_cost_hour"), v: venue.rental_cost != null ? formatMoney(venue.rental_cost, lang) : notSet },
        { k: t("sa_court_count"), v: venue.court_count ?? 1 },
      ].map(({ k, v }) => <div key={k} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-xl font-semibold">{v}</dd></div>)}
    </dl>
    <section className="space-y-2"><h3 className="text-sm font-semibold">{t("sa_location")}</h3><Details row={{
      "Location": location,
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
      {venue.location_link
        ? <DirectionsLinks locationLink={venue.location_link} query={venue.name} />
        : <p className="text-sm text-muted-foreground">{t("sa_map_missing")}</p>}
      {venue.location_link && (
        <div className="flex items-center gap-2">
          <a
            href={venue.location_link}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="min-w-0 flex-1 break-all text-xs text-primary underline underline-offset-4 hover:text-primary/80"
          >
            {venue.location_link}
          </a>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label={t("cal_copy")}
            onClick={copyLink}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success-ink" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </section>
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-semibold">{t("sa_rental_history")} ({rentals.length})</summary>
      <div className="mt-3 space-y-2">
        {rentals.length === 0 && <p className="text-sm text-muted-foreground">{t("sa_no_rentals")}</p>}
        {rentals.map(rental => <div key={rental.id} className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{rental.rental_date} · {formatTime12h(rental.start_time, lang)} · {rental.hours} {t("sa_records_hours")} · {formatMoney(rental.price, lang)}</p>
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
        <ProfileAvatar name={member.name ?? ""} url={member.avatar_url} avatarId={member.avatar_id} className="h-7 w-7 shrink-0" />
        <span className="truncate font-medium">{member.name || t("sa_unnamed_member")}</span>
        {member.username && <span className="shrink-0 text-xs text-muted-foreground">@{member.username}</span>}
        <span className="shrink-0 text-xs text-muted-foreground">{status}</span>
      </span>
    </summary>
    <div className="pt-3"><Details row={{
      Email: member.email || t("sa_no_login"),
      Phone: member.phone || t("sa_not_provided"),
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
    <AcademyTrainingManager academyId={academy.id} />
    <div className="flex flex-wrap gap-2 text-xs">{[planName, academy.is_trial ? trialExpired ? t("sa_trial_expired") : t("sa_trial") : t("sa_non_trial"), academy.is_public ? t("sa_public_listing") : t("sa_private_listing")].map(label => <span key={label} className="rounded-full bg-muted px-3 py-1 font-medium">{label}</span>)}</div>
    {academy.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{academy.description}</p>}
    <dl className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">{[{ k: t("sa_members"), v: members.length }, { k: t("sa_branches"), v: branches.length }, { k: t("sa_playgrounds"), v: venues.length }].map(({ k, v }) => <div key={k} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-xl font-semibold">{v}</dd></div>)}</dl>
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
function MemberDetails({ member: selectedMember, data, initialTab = "overview" }: { member: Row; data: Records; initialTab?: string }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [activeTab, setActiveTab] = useState(initialTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const member = data.profiles.find(row=>row.id===selectedMember.id) ?? selectedMember;
  const bookings = (data.academy_training_bookings??[]).filter(row=>row.member_id===member.id);
  const payments = data.payments.filter(r => r.member_id === member.id).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const attendance = data.attendance.filter(r => r.member_id === member.id);
  const games = data.friendly_game_participants.filter(r => r.member_id === member.id);
  const blocked = member.banned_until && new Date(member.banned_until) > new Date();
  const personalDetails = {
    [ar?"الاسم":"Name"]: member.name,
    [ar?"اسم المستخدم":"Username"]: member.username || "—",
    [ar?"الاسم المستعار":"Nickname"]: member.nickname || "—",
    [ar?"تاريخ الميلاد":"Date of birth"]: member.birth_date || "—",
    [ar?"العمر":"Age"]: memberAge(member.birth_date) ?? "—",
    [ar?"النوع":"Gender"]: member.gender === "male" ? (ar?"ذكر":"Male") : member.gender === "female" ? (ar?"أنثى":"Female") : "—",
    [ar?"الموقع":"Location"]: [member.area,member.governorate,member.country].filter(Boolean).join(", ") || "—",
    [ar?"نبذة":"Bio"]: member.bio || "—",
    [ar?"ولي الأمر":"Parent"]: data.profiles.find(p=>p.id===member.guardian_id)?.name || "—",
    [ar?"الرياضات المفضلة":"Interested sports"]: (member.interested_sports??[]).join(", ") || "—",
    [ar?"مستوى اللعب":"Skill level"]: member.skill_level || "—",
    [ar?"مركز اللعب":"Playing position"]: member.position || "—",
    Email: member.account_email || member.email || (member.guardian_id ? t("sa_no_login") : t("sa_not_provided")),
    Phone: member.phone || t("sa_not_provided"),
  };
  const membershipDetails = {
    Academy: data.academies.find(a => a.id === member.academy_id)?.name ?? t("sa_independent"),
    "Account status": blocked ? t("sa_blocked") : t("sa_enabled"),
    "Membership status": member.is_active ? t("sa_active") : t("sa_inactive"),
    "Platform plan": member.member_plan === "premium" ? t("sa_premium") : t("sa_free"),
    "Subscription sessions": member.subscription_sessions,
    "Sessions attended": member.sessions_attended,
    Joined: member.join_date ?? member.created_at?.slice(0, 10) ?? t("sa_unknown"),
    ...(member.member_plan === "premium" ? { "Premium expires": member.premium_expires_at?.slice(0, 10) ?? t("sa_no_expiry") } : {}),
  };
  const panelClass = "m-0 space-y-4 data-[state=inactive]:hidden";
  return <Tabs value={activeTab} onValueChange={value => { setActiveTab(value); if (scrollRef.current) scrollRef.current.scrollTop = 0; }} dir={ar ? "rtl" : "ltr"} className="flex min-h-0 flex-1 flex-col">
    <div className="shrink-0 space-y-4 border-b bg-muted/20 px-4 pb-4 sm:px-6">
      <div className="flex items-center gap-3">
        <ProfileAvatar name={member.name ?? ""} url={member.avatar_url} avatarId={member.avatar_id} className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold">{member.name}</p>
          <p className="truncate text-xs text-muted-foreground">{member.username ? `@${member.username} · ` : ""}{data.academies.find(a => a.id === member.academy_id)?.name ?? t("sa_independent")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className={cn("rounded-full border px-2 py-0.5", blocked ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-background")}>{blocked ? t("sa_blocked") : member.is_active ? t("sa_active") : t("sa_inactive")}</span>
            <span className="rounded-full border bg-background px-2 py-0.5">{member.member_plan === "premium" ? t("sa_premium") : t("sa_free")}</span>
            {member.is_parent && <span className="rounded-full border bg-background px-2 py-0.5">{ar ? "ولي أمر" : "Parent"}</span>}
          </div>
        </div>
      </div>
      <TabsList aria-label={ar ? "أقسام تفاصيل العضو" : "Member details sections"} className="grid w-full max-w-none grid-cols-3 gap-1 sm:grid-cols-5">
        {[
          ["overview", ar ? "نظرة عامة" : "Overview"],
          ["academies", ar ? "الأكاديميات" : "Academies"],
          ["payments", ar ? "المدفوعات" : "Payments"],
          ["family", ar ? "العائلة" : "Family"],
          ["activity", ar ? "النشاط" : "Activity"],
        ].map(([value, label]) => <TabsTrigger key={value} value={value} className="min-h-11 min-w-0 px-2 text-xs sm:text-sm">{label}</TabsTrigger>)}
      </TabsList>
    </div>
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
    <TabsContent value="overview" forceMount className={panelClass}>
      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">{ar ? "المعلومات الشخصية والتواصل" : "Personal & contact details"}</h3>
        <Details row={personalDetails} />
      </section>
      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">{ar ? "العضوية والاشتراك" : "Membership & subscription"}</h3>
        <Details row={membershipDetails} />
      </section>
      <MemberDetailsEditor key={member.id} member={member} />
    </TabsContent>
    <TabsContent value="academies" forceMount className={panelClass}>
    <MemberTrainingAssignment member={member} academies={data.academies} programs={data.academy_training_programs ?? []} />
    <section className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{ar?"الأكاديميات ومجموعات التدريب":"Academies & training groups"}</h3>
      <p className="text-sm">{ar?"الأكاديمية الأساسية":"Primary academy"}: {data.academies.find(a=>a.id===member.academy_id)?.name??t("sa_independent")}</p>
      {!bookings.length&&<p className="text-sm text-muted-foreground">{ar?"مفيش حجوزات تدريب":"No training bookings"}</p>}
      {bookings.map(booking=>{const program=(data.academy_training_programs??[]).find(p=>p.id===booking.program_id);const academy=data.academies.find(a=>a.id===program?.academy_id);return <div key={booking.id} className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm"><p className="font-semibold">{academy?.name??booking.details?.academy} · {program?.name??booking.details?.program}</p><p>{booking.details?.sport} · {booking.details?.playground}</p><p>{booking.kind} · {booking.status.replaceAll('_',' ')} · {formatMoney(Number(booking.amount),lang)}</p><p>{booking.registered_on} — {booking.expires_on}</p><details><summary className="cursor-pointer">{ar?"المواعيد المحجوزة":"Booked sessions"}</summary>{(booking.details?.sessions??[]).map((slot:Row)=><p key={`${slot.session_date}-${slot.starts_at}`}>{slot.session_date} · {slot.starts_at} – {slot.ends_at}</p>)}</details></div>;})}
    </section>
    </TabsContent>
    <TabsContent value="payments" forceMount className={panelClass}>
      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">{ar ? "مدفوعات التدريب" : "Training payments"}</h3>
        {!bookings.length && <p className="text-sm text-muted-foreground">{t("sa_no_payments")}</p>}
        {bookings.map(booking => <div key={booking.id} className="space-y-2 rounded-lg border p-3 text-sm"><p className="font-medium">{booking.details?.academy} · {booking.details?.program}</p><p>{booking.details?.session_count ?? booking.details?.sessions?.length} {t("sa_records_sessions")} · {formatMoney(Number(booking.amount),lang)} · {booking.status.replaceAll("_"," ")}</p><ConfirmTrainingPayment booking={booking} /></div>)}
        <Button variant="outline" asChild><a href="/admin?tab=Approvals">{ar ? "مراجعة إيصالات الدفع" : "Review payment receipts"}</a></Button>
      </section>
    <section className="rounded-xl border p-4"><h3 className="font-semibold">{ar?"مدفوعات الماتشات والاشتراكات":"Game payments & subscriptions"}</h3><div className="mt-3 space-y-3">
      {[
        {label:ar?"حصص الماتشات":"Game shares", rows:games, fields:(r:Row)=>({Game:data.friendly_games.find(g=>g.id===r.game_id)?.title,Amount:r.share_amount,Status:r.pay_status,Method:r.pay_method})},
        {label:ar?"إيجار الملاعب":"Court rent", rows:(data.friendly_game_rent_payments??[]).filter(r=>r.member_id===member.id),fields:(r:Row)=>({Game:data.friendly_games.find(g=>g.id===r.game_id)?.title,Amount:r.amount,Status:r.pay_status,Method:r.pay_method,Date:r.created_at})},
        {label:ar?"اشتراكات المنصة":"Platform subscriptions",rows:(data.plan_subscriptions??[]).filter(r=>r.user_id===member.id),fields:(r:Row)=>({Plan:r.plan,Cycle:r.billing_cycle,Amount:r.amount,Status:r.receipt_status,Date:r.created_at})},
      ].map(group=><section key={group.label}><h4 className="text-sm font-semibold">{group.label} ({group.rows.length})</h4>{group.rows.map(row=><div key={row.id} className="mt-2 rounded-lg border p-3"><Details row={group.fields(row)}/></div>)}</section>)}
    </div></section>
    <section className="rounded-xl border p-4"><h3 className="font-semibold">{t("sa_payment_history")} ({payments.length})</h3>
      <div className="mt-3 space-y-2">{payments.length === 0 && <p className="text-sm text-muted-foreground">{t("sa_no_payments")}</p>}{payments.map(payment => <div key={payment.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{payment.payment_date} · {payment.amount} · {String(payment.method ?? "").replaceAll("_", " ")}</p><p className="text-muted-foreground">{payment.subscription_sessions} {t("sa_records_sessions")}{payment.notes ? ` · ${payment.notes}` : ""}</p></div>)}</div>
    </section>
    </TabsContent>
    <TabsContent value="family" forceMount className={panelClass}>
      <MemberFamilyManager key={member.id} memberId={member.id} academies={data.academies.map(a=>({id:a.id,name:a.name}))} />
    </TabsContent>
    <TabsContent value="activity" forceMount className={panelClass}>
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">{ar ? "البطولات" : "Tournaments"}</h3>
      {!(data.tournament_participants ?? []).some(r => r.member_id === member.id) && <p className="text-sm text-muted-foreground">{ar ? "مفيش مشاركات في البطولات" : "No tournament entries"}</p>}
      {(data.tournament_participants ?? []).filter(r => r.member_id === member.id).map(r => <Details key={r.id ?? r.tournament_id} row={{ Tournament: data.tournaments.find(item => item.id === r.tournament_id)?.name ?? r.tournament_id, Joined: r.added_at }} />)}
    </section>
    <section className="rounded-xl border p-4"><h3 className="font-semibold">{t("sa_activity")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("sa_attended")}: {attendance.filter(r => r.is_present).length} / {attendance.length}</p>
      <div className="mt-3 space-y-2 text-sm">{attendance.length === 0 && games.length === 0 && <p className="text-muted-foreground">{t("sa_no_activity")}</p>}{attendance.map(record => {
        const session = data.training_sessions.find(item => item.id === record.session_id);
        return <div key={record.id} className="space-y-2 rounded-lg border p-3"><p>{session?.date ?? t("sa_unknown_date")} · {t("sa_training")} · {record.is_present ? t("sa_attended") : t("sa_absent")}</p><MemberAttendanceEdit memberId={member.id} record={record} /></div>;
      })}{games.map(record => {
        const game = data.friendly_games.find(item => item.id === record.game_id);
        return <p key={record.id} className="rounded-lg border p-3">{game?.game_date ?? t("sa_unknown_date")} · {game?.title ?? t("sa_friendly_game")} · {record.is_waitlisted ? t("sa_waitlisted") : record.role === "organizer" ? t("sa_organizer") : t("sa_player")}</p>;
      })}</div>
    </section>
    </TabsContent>
    </div>
  </Tabs>;
}
function GameParticipantAccount({ participant, data }: { participant: Row; data: Records }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const member = data.profiles.find(p => p.id === participant.member_id);
  const name = member?.name ?? participant.player_name ?? (lang === "ar" ? "لاعب" : "Player");
  if (!participant.member_id) return <p className="text-sm font-medium">{name} <span className="text-xs text-muted-foreground">({lang === "ar" ? "ضيف بدون حساب" : "Guest · no account"})</span></p>;
  return <>
    <button type="button" onClick={() => setOpen(true)} className="max-w-full truncate text-start text-sm font-semibold underline decoration-dotted underline-offset-4 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" aria-label={`${lang === "ar" ? "عرض حساب" : "View account:"} ${name}`}>{name}</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[90dvh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-4 py-4 text-start sm:px-6">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{lang === "ar" ? "تفاصيل الحساب — اقفل للرجوع إلى الماتش." : "Account details — close to return to the game."}</DialogDescription>
        </DialogHeader>
        {member ? <MemberDetails key={member.id} member={member} data={data} /> : <p className="p-6 text-sm text-muted-foreground">{lang === "ar" ? "الحساب غير متاح." : "This account is unavailable."}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
function GameParticipantRow({ participant, data }: { participant: Row; data: Records }) {
  const { t, lang } = useI18n();
  const pay = participant.is_waitlisted
    ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t("sa_waitlisted")}</span>
    : participant.pay_status === "approved"
      ? <span className="rounded-full bg-positive-100 px-2 py-0.5 text-xs font-medium text-success-ink ">{t("sa_records_paid")}</span>
      : participant.pay_status === "pending"
        ? <span className="rounded-full bg-attention-100 px-2 py-0.5 text-xs font-medium text-warning-ink ">{t("games_share_pending")}</span>
        : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t("sa_records_unpaid")}</span>;
  const name = participant.name ?? participant.player_name ?? t("sa_unnamed_member");
  return <div className="flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2">
    <ProfileAvatar name={name} url={participant.avatar_url} avatarId={participant.avatar_id} className="h-8 w-8 shrink-0" />
    <div className="min-w-0 flex-1">
      <GameParticipantAccount participant={participant} data={data} />
      <p className="text-xs text-muted-foreground">{participant.role === "organizer" ? t("sa_organizer") : t("sa_player")}{participant.share_amount != null && Number(participant.share_amount) > 0 && <span> · {formatMoney(participant.share_amount, lang)}</span>}</p>
    </div>
    {pay}
    <ParticipantPayment participantId={participant.id} name={name} receiptPath={participant.pay_receipt_url ?? null} status={participant.pay_status} />
  </div>;
}
function ManageGamePlayers({ game, data }: { game: Row; data: Records }) {
  const { t, lang } = useI18n();
  const addMember = useAdminAddGameMember();
  const removeMember = useAdminRemoveGameMember();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const participants = data.friendly_game_participants.filter(p => p.game_id === game.id);
  const memberIds = new Set(participants.map(p => p.member_id));
  const { confirmed: roster, awaitingPayment, waitlisted: waitlist } = splitGameParticipants(participants);
  const canManage = game.status === "open" || game.status === "full";
  const busy = addMember.isPending || removeMember.isPending;
  const notSet = t("sa_unnamed_member");

  const candidates = (data.profiles ?? []).filter((p: Row) => !memberIds.has(p.id));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? candidates.filter((p: Row) =>
        String(p.name ?? "").toLowerCase().includes(q) ||
        (p.username && String(p.username).toLowerCase().includes(q)) ||
        (p.account_email && String(p.account_email).toLowerCase().includes(q))
      )
    : candidates;

  const add = (memberId: string) => {
    addMember.mutate(
      { gameId: game.id, memberId },
      {
        onSuccess: () => toast.success(t("sa_game_member_added")),
        onError: error => toast.error(errorMessage(error, t("common_error"))),
      }
    );
    setOpen(false);
    setQuery("");
  };
  const remove = (memberId: string) => {
    removeMember.mutate(
      { gameId: game.id, memberId },
      {
        onSuccess: () => toast.success(t("sa_game_member_removed")),
        onError: error => toast.error(errorMessage(error, t("common_error"))),
      }
    );
  };

  const memberRow = (participant: Row, canRemove: boolean) => {
    const name = participant.name ?? participant.player_name ?? notSet;
    const pay = participant.is_waitlisted
      ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t("sa_waitlisted")}</span>
      : participant.pay_status === "approved"
        ? <span className="rounded-full bg-positive-100 px-2 py-0.5 text-xs font-medium text-success-ink ">{t("sa_records_paid")}</span>
        : participant.pay_status === "pending"
          ? <span className="rounded-full bg-attention-100 px-2 py-0.5 text-xs font-medium text-warning-ink ">{t("games_share_pending")}</span>
          : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t("sa_records_unpaid")}</span>;
    const removing = removeMember.isPending && removeMember.variables?.memberId === participant.member_id;
    return <div key={participant.id} className="flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2">
      <ProfileAvatar name={name} url={participant.avatar_url} avatarId={participant.avatar_id} className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <GameParticipantAccount participant={participant} data={data} />
        <p className="text-xs text-muted-foreground">{participant.role === "organizer" ? t("sa_organizer") : t("sa_player")}{participant.share_amount != null && Number(participant.share_amount) > 0 && <span> · {formatMoney(participant.share_amount, lang)}</span>}</p>
      </div>
      {pay}
      {canRemove && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => remove(participant.member_id)}>
        {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundX className="me-1 h-4 w-4" />}
        {t("sa_game_remove_member")}
      </Button>}
    </div>;
  };

  return <section className="space-y-2">
    <h3 className="text-sm font-semibold">{t("sa_game_manage_players")}</h3>
    {!canManage ? <p className="text-sm text-muted-foreground">{t("sa_game_finished_no_manage")}</p> : <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={busy} className="h-9 w-full justify-between font-normal">
            <span className="flex min-w-0 items-center"><UserPlus className="me-1.5 h-4 w-4 shrink-0" /><span className="truncate">{t("sa_game_add_member")}</span></span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={12} className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("sa_game_member_search")}
            dir="auto"
            className="h-9 rounded-none border-0 border-b focus-visible:ring-0"
          />
          <div className="max-h-[min(22rem,60dvh)] overscroll-contain overflow-auto p-1">
            <SortedOptions>
              {filtered.length === 0
                ? <p className="px-3 py-2 text-sm text-muted-foreground">{query ? t("sa_game_no_roster") : t("sa_game_no_candidates")}</p>
                : filtered.map((member: Row) => {
                    const name = member.name ?? notSet;
                    return <button
                      key={member.id}
                      type="button"
                      onClick={() => add(member.id)}
                      className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-start text-sm hover:bg-accent focus:outline-none focus:bg-accent"
                      dir="auto"
                    >
                      <ProfileAvatar name={name} url={member.avatar_url} avatarId={member.avatar_id} className="h-8 w-8 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      {(member.username || member.account_email) && <span className="shrink-0 truncate text-xs text-muted-foreground">@{member.username ?? member.account_email}</span>}
                    </button>;
                  })}
            </SortedOptions>
          </div>
        </PopoverContent>
      </Popover>
      <p className="text-xs font-semibold">{lang === "ar" ? "اللاعبون المؤكدون (الدفع معتمد)" : "Confirmed players (payment approved)"} ({roster.length})</p>
      <div className="space-y-2">
        {roster.length ? roster.sort((a, b) => Number(b.role === "organizer") - Number(a.role === "organizer")).map(p => memberRow(p, p.role !== "organizer")) : <p className="text-sm text-muted-foreground">{t("sa_game_no_roster")}</p>}
      </div>
      {awaitingPayment.length > 0 && <>
        <p className="pt-1 text-xs font-semibold text-warning-ink">{lang === "ar" ? "في انتظار تأكيد الدفع — غير مقبولين بعد" : "Awaiting payment confirmation — not accepted yet"} ({awaitingPayment.length})</p>
        <div className="space-y-2">{awaitingPayment.map(p => memberRow(p, p.role !== "organizer"))}</div>
      </>}
      {waitlist.length > 0 && <>
        <p className="pt-1 text-xs font-semibold text-muted-foreground">{t("sa_game_waitlist")} ({waitlist.length})</p>
        <div className="space-y-2">{waitlist.map(p => memberRow(p, true))}</div>
      </>}
    </>}
  </section>;
}
function GameDetails({ game, data }: { game: Row; data: Records }) {
  const { t, lang } = useI18n();
  const inviteCode = typeof game.invite_code === "string" ? game.invite_code.trim() : "";
  const inviteLink = inviteCode ? `${SITE_URL}/games?join=${encodeURIComponent(inviteCode)}` : null;
  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(t("games_invite_copied"));
    } catch {
      toast.error(t("common_error"));
    }
  };
  const notSet = t("sa_not_set");
  const participants = data.friendly_game_participants.filter(p => p.game_id === game.id);
  const { confirmed: players, awaitingPayment, waitlisted: waitlist } = splitGameParticipants(participants);
  const paid = players;
  const creator = data.profiles.find(p => p.id === game.creator_id);
  const playground = data.venues.find(v => v.id === game.playground_id);
  const statusStyle = GAME_STATUS_STYLES[game.status] ?? "bg-muted text-muted-foreground";
  const status = t(`community_status_${game.status}` as keyof Dict) ?? notSet;
  const location = [playground?.area, playground?.governorate, game.area].filter(Boolean).join(" · ");
  const criteria = [
    game.gender !== "mixed" ? t(`games_gender_${game.gender}` as keyof Dict) : null,
    game.min_age != null || game.max_age != null
      ? game.max_age != null && game.min_age != null
        ? `${game.min_age}–${game.max_age}`
        : game.min_age != null ? `${game.min_age}+` : `–${game.max_age}`
      : null,
  ].filter(Boolean);
  const rentPerHour = game.playground_hourly_rate ?? null;
  const rentTotal = rentPerHour != null && game.duration_hours != null ? rentPerHour * game.duration_hours : null;
  return <div className="space-y-5">
    <GameTeamsButton gameId={game.id} date={game.game_date} time={game.start_time} status={game.status} canManage />
    <GameBookingStatus game={{ sport: game.sport, min_players: game.min_players, duration_hours: game.duration_hours,
      playground_hourly_rate: game.playground_hourly_rate, share_price: game.share_price, host_total: game.host_total, booking_total: game.booking_total, host_pays: game.host_pays, status: game.status,
      participants, rent_payments: (data.friendly_game_rent_payments ?? []).filter(p => p.game_id === game.id).map(p => ({ amount: p.amount, pay_status: p.pay_status })) }} />
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-full bg-muted px-3 py-1 font-medium">{game.sport}</span>
      <span className={`rounded-full px-3 py-1 font-medium ${statusStyle}`}>{status}</span>
      <span className="rounded-full bg-muted px-3 py-1 font-medium">{game.is_public === false ? t("games_private") : t("games_public")}</span>
      {game.host_pays && <span className="rounded-full bg-muted px-3 py-1 font-medium">{t("games_host_pays_badge")}</span>}
      {game.recurrence && <span className="rounded-full bg-muted px-3 py-1 font-medium">{t("community_weekly")}</span>}
    </div>
    {game.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{game.description}</p>}
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{lang === "ar" ? "رابط دعوة الماتش" : "Game invite link"}</h3>
      {inviteLink ? <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
        <a href={inviteLink} target="_blank" rel="noopener noreferrer" dir="ltr" className="min-w-0 flex-1 break-all text-sm text-primary underline underline-offset-4">{inviteLink}</a>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={copyInviteLink}>
          <Copy className="me-1 h-4 w-4" />{t("games_copy_invite")}
        </Button>
      </div> : <p className="text-sm text-muted-foreground">{notSet}</p>}
    </section>
    <dl className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
      {[
        { k: t("sa_game_date"), v: game.game_date ?? notSet },
        { k: t("sa_game_time"), v: game.start_time ? formatTime12h(String(game.start_time), lang) : notSet },
        { k: t("sa_game_duration"), v: game.duration_hours != null ? `${game.duration_hours} ${t("sa_records_hours")}` : notSet },
      ].map(({ k, v }) => <div key={k} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-xl font-semibold">{v}</dd></div>)}
    </dl>
    <section className="space-y-2"><h3 className="text-sm font-semibold">{lang === "ar" ? "اللاعبون المؤكدون (الدفع معتمد)" : "Confirmed players (payment approved)"}</h3>
      <div className="rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-lg font-semibold">{players.length}/{game.max_players}</span>
          <span className="text-muted-foreground">{t("sa_game_min")}: {game.min_players ?? notSet}{waitlist.length > 0 && <span> · {t("sa_game_waitlist")}: {waitlist.length}</span>}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${game.max_players > 0 ? Math.min(100, (players.length / game.max_players) * 100) : 0}%` }} /></div>
      </div>
    </section>
    <ManageGamePlayers game={game} data={data} />
    <section className="space-y-2"><h3 className="text-sm font-semibold">{t("sa_game_organizer")}</h3>
      <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
        <ProfileAvatar name={creator?.name ?? game.creator_name ?? ""} url={creator?.avatar_url} avatarId={creator?.avatar_id} className="h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{creator?.name ?? game.creator_name ?? notSet}</p>
          {(game.creator_username || creator?.username) && <p className="truncate text-xs text-muted-foreground">@{game.creator_username ?? creator?.username}</p>}
        </div>
      </div>
    </section>
    <section className="space-y-2"><h3 className="text-sm font-semibold">{t("sa_game_playground")}</h3>
      {playground?.name || game.location
        ? <div className="space-y-1 text-sm"><p className="font-medium">{playground?.name ?? game.location}</p>{location && <p className="text-muted-foreground">{location}</p>}{playground?.location_link && <a href={playground.location_link} target="_blank" rel="noopener noreferrer" dir="ltr" className="block break-all text-xs text-primary underline underline-offset-4 hover:text-primary/80">{playground.location_link}</a>}</div>
        : <p className="text-sm text-muted-foreground">{t("games_no_playground")}</p>}
    </section>
    <section className="space-y-2"><h3 className="text-sm font-semibold">{t("sa_game_criteria")}</h3>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-3 py-1 font-medium">{game.skill_level ? t(`skill_${game.skill_level}` as keyof Dict) : t("community_any_level")}</span>
        {criteria.length ? criteria.map(c => <span key={c} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-medium text-primary">{c}</span>) : <span className="rounded-full bg-muted px-3 py-1 font-medium">{t("games_any_age")}</span>}
        {!game.is_public && game.invite_code && <span className="rounded-full bg-muted px-3 py-1 font-medium"><span className="me-1 text-muted-foreground">{t("sa_game_invite")}:</span><bdi dir="ltr">{game.invite_code}</bdi></span>}
      </div>
    </section>
    <section className="space-y-2"><h3 className="text-sm font-semibold">{t("sa_game_cost")}</h3>
      <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <div><p className="text-xs text-muted-foreground">{t("sa_game_share_price")}</p><p className="font-semibold">{game.share_price != null ? formatMoney(game.share_price, lang) : notSet}</p></div>
        <div><p className="text-xs text-muted-foreground">{t("sa_rental_cost_hour")}</p><p className="font-semibold">{rentPerHour != null ? formatMoney(rentPerHour, lang) : notSet}</p></div>
        <div><p className="text-xs text-muted-foreground">{t("sa_game_total_rent")}</p><p className="font-semibold">{rentTotal != null ? formatMoney(rentTotal, lang) : notSet}</p></div>
        <div><p className="text-xs text-muted-foreground">{t("sa_game_covered")}</p><p className="font-semibold">{`${paid.length}/${players.length + awaitingPayment.length}`}</p></div>
      </div>
    </section>
    <dl className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">{t("sa_created")}</dt><dd className="mt-1 break-words font-medium">{game.created_at?.slice(0, 10) ?? notSet}</dd></div></dl>
    <p className="text-xs text-muted-foreground">{t("sa_record_id")} <span className="break-all font-mono" dir="ltr">{game.id}</span></p>
  </div>;
}
export function PlatformRecords() {
  const { t, lang } = useI18n();
  const cache = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabs = [
    { value: "Members", label: t("sa_records_members") },
    { value: "Academies", label: t("sa_records_academies") },
    { value: "Friendly games", label: t("sa_records_games") },
    { value: "Tournaments", label: t("sa_records_tournaments") },
    { value: "Playgrounds", label: t("sa_records_playgrounds") },
    { value: "Sports", label: t("sa_records_sports") },
  ] as const;
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery<Records>({ queryKey: ["platform-records"], staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: "always", refetchInterval: 30_000, queryFn: async () => {
    const response = await fetch("/api/platform-admin", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  } });
  const [tab, setTab] = useState<(typeof tabs)[number]["value"]>("Members");
  const [search, setSearch] = useState("");
  const [recordsPage, setRecordsPage] = useState(1);
  useEffect(() => { setRecordsPage(1); }, [search, tab]);
  const [date, setDate] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`);
  const [selected, setSelected] = useState<Row | null>(null);
  const [editingGame, setEditingGame] = useState<Row | null>(null);
  const [memberInitialTab, setMemberInitialTab] = useState("overview");
  const [deletingVenue, setDeletingVenue] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [trainingAcademy, setTrainingAcademy] = useState<Row | null>(null);
  const [editingAcademy, setEditingAcademy] = useState<Academy | null>(null);
  const [logoAcademy, setLogoAcademy] = useState<Academy | null>(null);
  const [editingVenue, setEditingVenue] = useState<VenueDraft | null>(null);
  const [tournamentFormOpen, setTournamentFormOpen] = useState(false);
  // Draft inputs for the Sports tab's per-sport minimum-players editor.
  const [sportDraft, setSportDraft] = useState<Record<string, string>>({});
  const [deletingAcademy, setDeletingAcademy] = useState<Academy | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0 || !editingVenue) return;
    setUploadingPhoto(true);
    try {
      const supabase = createClient();
      const urls: string[] = [];
      for (const file of files) {
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `venues/photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("venue-photos").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("venue-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setEditingVenue(c => (c ? { ...c, photos: [...(c.photos ?? []), ...urls] } : c));
    } catch {
      toast.error(t("sa_photo_failed"));
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };
  const setCardPhoto = (url: string) => setEditingVenue(c => (c ? { ...c, cover_url: url } : c));
  const setRemovePhoto = (url: string) => setEditingVenue(c => {
    if (!c) return c;
    return { ...c, photos: (c.photos ?? []).filter(p => p !== url), cover_url: c.cover_url === url ? null : c.cover_url };
  });
  const removeAcademy = useSuperAdminDeleteAcademy();
  const cancelGame = useCancelFriendlyGame();
  const [cancellingGame, setCancellingGame] = useState<Row | null>(null);
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
  const requestedGame = searchParams.get("game");
  useEffect(() => {
    if (requestedGame && tab === "Friendly games" && data?.friendly_games) {
      const game = data.friendly_games.find(row => row.id === requestedGame);
      if (game) setSelected(game);
    }
  }, [requestedGame, tab, data]);
  const act = async (body: Row) => {
    setBusy(true);
    try {
      const response = await fetch("/api/platform-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success(body.action === "venue" ? t("sa_playground_updated") : body.action === "delete_venue" ? t("sa_playground_deleted") : body.action === "delete" ? t("sa_account_deleted") : t("sa_account_updated"));
      if (body.action === "venue") setEditingVenue(null);
      setDeleting(null); setDeletingVenue(null); setConfirmation("");
      await cache.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("sa_action_failed")); }
    finally { setBusy(false); }
  };
  const dialogDescription = tab === "Members" ? t("sa_records_detail_member")
    : tab === "Academies" ? t("sa_records_detail_academy")
    : tab === "Friendly games" ? t("sa_records_detail_game")
    : tab === "Playgrounds" ? t("sa_records_detail_venue")
    : t("sa_records_detail_other");
  const duplicateVenue = (row: Row) => {
    if (!row) return;
    setEditingVenue({
      ...row,
      id: undefined,
      duplicate_of: row.name,
      lat: row.lat ? String(row.lat) : "",
      lng: row.lng ? String(row.lng) : "",
    });
  };
  if (isLoading) return <Card><CardContent className="flex items-center gap-2 p-6" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t("common_loading")}</CardContent></Card>;
  if (!data) return <Card><CardContent className="p-6"><p role="alert">{error?.message ?? t("sa_could_not_load")}</p><Button onClick={() => refetch()}>{t("sa_retry")}</Button></CardContent></Card>;
  const sports = data.sports ?? [];
  const sportOptions = Array.from(new Map(sports.map(s => [String(s.name).toLowerCase(), s])).values())
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }));
  if (editingVenue?.sport_id && !sportOptions.some(s => s.id === editingVenue.sport_id)) {
    const assigned = sports.find(s => s.id === editingVenue.sport_id);
    if (assigned) sportOptions.push(assigned);
  }
  const sportById = new Map(sports.map((s) => [s.id, s.name]));
  const handleSportSelect = (newSportId: string | null) => {
    setEditingVenue((current) => current && { ...current, sport_id: newSportId });
  };
  const editingVenueCoords = editingVenue ? parseMapsCoordinates(editingVenue.location_link ?? "") : null;
  const academy = (id: string) => data.academies.find(a => a.id === id)?.name ?? (id ? t("sa_academy_unavailable") : t("sa_independent"));
  const source = tab === "Members" ? data.profiles : tab === "Academies" ? data.academies : tab === "Friendly games" ? data.friendly_games : tab === "Tournaments" ? data.tournaments : tab === "Sports" ? data.sport_settings : data.venues;
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
  const isPaginated = tab === "Members" || tab === "Friendly games";
  if (isPaginated) {
    const joinedAt = (row: Row) => {
      const timestamp = Date.parse(row.created_at || (tab === "Members" ? row.join_date : "") || "");
      return Number.isFinite(timestamp) ? timestamp : 0;
    };
    rows.sort((a, b) => joinedAt(b) - joinedAt(a) || String(a.id).localeCompare(String(b.id)));
  }
  const recordsPageSize = 20;
  const recordsPageCount = Math.max(1, Math.ceil(rows.length / recordsPageSize));
  const currentRecordsPage = Math.min(recordsPage, recordsPageCount);
  const visibleRows = isPaginated
    ? rows.slice((currentRecordsPage - 1) * recordsPageSize, currentRecordsPage * recordsPageSize)
    : rows;
  const recordsPagination = isPaginated && rows.length > 0 ? <nav aria-label={tab === "Members" ? (lang === "ar" ? "صفحات الأعضاء" : "Member pages") : (lang === "ar" ? "صفحات الماتشات" : "Game pages")} className="flex flex-wrap items-center justify-between gap-3">
    <p className="text-sm text-muted-foreground" aria-live="polite">{lang === "ar" ? "عرض" : "Showing"} {(currentRecordsPage - 1) * recordsPageSize + 1}–{Math.min(currentRecordsPage * recordsPageSize, rows.length)} {lang === "ar" ? "من" : "of"} {rows.length}</p>
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={currentRecordsPage === 1} onClick={() => setRecordsPage(currentRecordsPage - 1)}>{lang === "ar" ? "السابق" : "Previous"}</Button>
      <span className="text-sm">{lang === "ar" ? "صفحة" : "Page"} {currentRecordsPage} / {recordsPageCount}</span>
      <Button variant="outline" size="sm" disabled={currentRecordsPage === recordsPageCount} onClick={() => setRecordsPage(currentRecordsPage + 1)}>{lang === "ar" ? "التالي" : "Next"}</Button>
    </div>
  </nav> : null;
  const searchLabel = tab === "Members" ? t("sa_records_search_members")
    : tab === "Academies" ? t("sa_records_search_academies")
    : t("sa_records_search_general");
  const related = selected ? (tab === "Members" ? { Payments: data.payments.filter(r => r.member_id === selected.id), Attendance: data.attendance.filter(r => r.member_id === selected.id), Games: data.friendly_game_participants.filter(r => r.member_id === selected.id) } : tab === "Academies" ? { [t("sa_members")]: data.profiles.filter(r => r.academy_id === selected.id), [t("sa_branches")]: data.academy_branches.filter(r => r.academy_id === selected.id), [t("sa_membership_plans")]: data.membership_plans.filter(r => r.academy_id === selected.id), [t("sa_playgrounds")]: data.venues.filter(r => r.academy_id === selected.id) } : tab === "Friendly games" ? Object.fromEntries(Object.entries(splitGameParticipants(data.friendly_game_participants.filter(r => r.game_id === selected.id))).map(([group, rows]) => [group === "confirmed" ? (lang === "ar" ? "اللاعبون المؤكدون" : "Confirmed players") : group === "awaitingPayment" ? (lang === "ar" ? "في انتظار تأكيد الدفع — غير مقبولين بعد" : "Awaiting payment confirmation — not accepted yet") : (lang === "ar" ? "قائمة الانتظار" : "Waitlist"), rows.map(r => {
    const profile = data.profiles.find(p => p.id === r.member_id);
    return { ...r, name: profile?.name ?? r.player_name, avatar_url: profile?.avatar_url, avatar_id: profile?.avatar_id ?? null };
  })])) : tab === "Tournaments" ? {
    [t("sa_records_teams")]: data.tournament_teams.filter(r => r.tournament_id === selected.id).map(r => ({ id: r.id, name: r.name, players: data.tournament_team_members.filter(m => m.team_id === r.id).length })),
    [t("sa_records_participants")]: data.tournament_participants.filter(r => r.tournament_id === selected.id).map(r => ({ id: r.id, member: data.profiles.find(p => p.id === r.member_id)?.name ?? r.member_id })),
    [t("sa_records_matches")]: data.tournament_matches.filter(r => r.tournament_id === selected.id).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)).map(r => ({ id: r.id, round: r.round_name, matchup: `${data.tournament_teams.find(x => x.id === r.team_a_id)?.name ?? "TBD"} vs ${data.tournament_teams.find(x => x.id === r.team_b_id)?.name ?? "TBD"}`, score: r.score_a != null ? `${r.score_a} – ${r.score_b}` : "—", status: r.status })),
  } : {}) : {};
  const colorful = tab === "Members" || tab === "Friendly games";
  const recordColor = tab === "Members" ? "from-brand to-brand-900" : "from-brand to-brand-900";
  const RecordIcon = tab === "Members" ? Users : Trophy;
  return <Card className="overflow-hidden rounded-2xl">
    {colorful && <div className={`relative isolate overflow-hidden bg-gradient-to-br ${recordColor} px-5 py-6 text-white sm:px-6`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10"><RecordIcon className="absolute -bottom-4 end-8 h-36 w-36 -rotate-12 text-white/15" strokeWidth={1} /><Sparkles className="absolute top-4 end-5 h-7 w-7 text-amber-200/50" /><div className="absolute -top-20 -end-12 h-64 w-64 rounded-full border-[24px] border-white/10" /></div>
      <span aria-hidden="true" className="inline-flex rounded-xl border border-white/20 bg-white/10 p-2"><RecordIcon className="h-6 w-6" /></span>
      <h2 className="mt-3 text-2xl font-extrabold">{tab === "Members" ? t("sa_records_members") : t("sa_records_games")}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90">{tab === "Members" ? (lang === "ar" ? "تابع حسابات اللاعبين والأكاديميات والاشتراكات من مكان واحد." : "Manage player accounts, academy connections, and subscriptions in one place.") : (lang === "ar" ? "تابع الماتشات واللاعبين والحجوزات والمدفوعات." : "Keep track of games, players, bookings, and payments.")}</p>
    </div>}
    <CardHeader><CardTitle>{t("sa_records_title")}</CardTitle><p className="text-sm text-muted-foreground">{t("sa_records_counts").replace("{accounts}", String(data.profiles.length)).replace("{academies}", String(data.academies.length)).replace("{games}", String(data.friendly_games.length)).replace("{playgrounds}", String(data.venues.length))}</p></CardHeader>
    <CardContent className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{lang === "ar" ? "مقدرناش نحدّث البيانات. المعروض دلوقتي آخر بيانات اتحمّلت بنجاح. جرّب زر التحديث." : "Could not refresh. Showing the last successfully loaded records. Try the refresh button."}</p>}
      {dataUpdatedAt > 0 && <p className="text-xs text-muted-foreground">{lang === "ar" ? "آخر تحديث" : "Last updated"}: <time dateTime={new Date(dataUpdatedAt).toISOString()}>{new Date(dataUpdatedAt).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-GB")}</time></p>}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("sa_records_title")}>{tabs.map(item => <Button key={item.value} role="tab" aria-selected={tab === item.value} variant={tab === item.value ? "secondary" : "outline"} onClick={() => { router.push(`/admin?tab=${encodeURIComponent(item.value)}`, { scroll: false }); }}>{item.label}</Button>)}</div>
      <div className="flex flex-wrap gap-2"><Input className="max-w-sm" type="search" aria-label={searchLabel} placeholder={`${searchLabel}…`} value={search} onChange={e => setSearch(e.target.value)} />{tab === "Playgrounds" && <Input className="w-auto" type="date" aria-label={t("sa_records_schedule_date")} value={date} onChange={e => setDate(e.target.value)} />}{tab === "Playgrounds" && <Button disabled={busy} onClick={() => setEditingVenue({ name: "", capacity: "", sport_id: null, school_name: "", rental_cost: "", rental_hours: "1", location_link: "", country: "", governorate: "", area: "", contact_person: "", contact_phone: "", lat: "", lng: "", photos: [], cover_url: null, academy_id: null, court_count: "1", unavailable_slots: [], working_hours: [] })}><Plus className="mr-1 h-4 w-4 rtl:ml-1 rtl:mr-0" />{t("sa_records_add_playground")}</Button>}{tab === "Tournaments" && <Button onClick={() => setTournamentFormOpen(true)}><Plus className="mr-1 h-4 w-4 rtl:ml-1 rtl:mr-0" />{t("sa_records_add_tournament")}</Button>}<Button variant="outline" disabled={isFetching} onClick={() => { setRecordsPage(1); void refetch(); }}>{isFetching && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}{t("sa_records_refresh")}</Button></div>
      {tab === "Academies" && <CreateAcademyButton />}
      {tab === "Playgrounds" && <p className="text-sm text-muted-foreground">{t("sa_records_schedule_note")}</p>}
      <p className="text-xs text-muted-foreground">{t("sa_records_results").replace("{shown}", String(rows.length)).replace("{total}", String(source.length))}</p>
      <div className="space-y-3">
      {tab === "Sports" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("sa_sports_note")}</p>
          {(COMMUNITY_SPORTS as readonly string[]).map(sport => {
            const saved = data.sport_settings.find(s => s.sport === sport);
            const effective = saved?.min_players ?? getDefaultMinPlayers(sport);
            const draft = sportDraft[sport] ?? String(effective);
            const overridden = saved != null;
            return (
              <form
                key={sport}
                className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
                onSubmit={e => {
                  e.preventDefault();
                  act({ action: "sport_setting", sport, min_players: Number(draft) });
                }}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{sport}</span>
                {overridden ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t("sa_sports_overridden")}</span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t("sa_sports_default")}</span>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t("sa_sports_min_players")}</span>
                  <Input
                    type="number"
                    dir="ltr"
                    min="2"
                    max="30"
                    className="w-20"
                    aria-label={`${sport} — ${t("sa_sports_min_players")}`}
                    value={draft}
                    onChange={e => setSportDraft(c => ({ ...c, [sport]: e.target.value }))}
                  />
                </label>
                <Button type="submit" size="sm" disabled={busy || Number(draft) === effective || !Number.isInteger(Number(draft)) || Number(draft) < 2 || Number(draft) > 30}>
                  {busy ? t("sa_saving") : t("sa_save")}
                </Button>
              </form>
            );
          })}
        </div>
      ) : (
      <>
      {rows.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("sa_records_empty")}</p>}
      {recordsPagination}
      <div className={tab === "Friendly games" ? "grid grid-cols-1 gap-4 lg:grid-cols-3" : "space-y-3"}>
      {visibleRows.map(row => {
        const gameVenue = tab === "Friendly games" ? data.venues.find(venue => venue.id === row.playground_id) : undefined;
        const gamePhoto = venueCardPhoto(gameVenue?.photos, gameVenue?.cover_url);
        const blocked = row.banned_until && new Date(row.banned_until) > new Date();
        const protectedAccount = PLATFORM_ADMIN_EMAILS.includes(row.email?.toLowerCase() ?? "");
        if (["Members"].includes(tab)) return (
          <details key={row.id} className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card open:border-primary/30">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden sm:px-4">
              <ProfileAvatar name={row.name ?? ""} url={row.avatar_url} avatarId={row.avatar_id} className="h-9 w-9 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{row.name ?? row.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{row.email || t("sa_no_login")}</span>
              </span>
              <span className="hidden max-w-40 truncate text-xs text-muted-foreground lg:block">{academy(row.academy_id)}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${blocked ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{blocked ? t("sa_blocked") : t("sa_enabled")}</span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 border-t border-border px-3 py-3 sm:px-4">
              {row.guardian_id && <p className="text-xs font-medium text-muted-foreground">{t("sa_family_member")}</p>}
              <dl className="grid grid-cols-1 gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t("sa_academy")}</dt><dd className="mt-1 break-words font-medium">{academy(row.academy_id)}</dd><dd className="text-xs text-muted-foreground">{row.academy_id ? row.is_active ? t("sa_active_membership") : t("sa_pending_membership") : t("sa_not_joined")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("sa_platform_plan")}</dt><dd className="mt-1 font-medium">{row.member_plan === "premium" ? t("sa_premium") : t("sa_free")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("sa_academy_subscription")}</dt><dd className="mt-1 font-medium">{row.academy_id && row.subscription_sessions > 0 ? `${row.subscription_sessions} ${t("sa_records_sessions")}` : t("sa_no_subscription")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("sa_sessions_attended")}</dt><dd className="mt-1 font-medium">{row.sessions_attended ?? 0}</dd></div>
          </dl>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setMemberInitialTab("overview"); setSelected(row); }}>{t("sa_records_details")}</Button>
                <Button size="sm" variant="outline" disabled={busy || protectedAccount} onClick={() => { setMemberInitialTab("academies"); setSelected(row); }}>{lang === "ar" ? "الأكاديمية والاشتراك" : "Academy & subscription"}</Button>
                <Button size="sm" variant="outline" disabled={busy || protectedAccount} onClick={() => act({ action: "block", id: row.id, blocked: !blocked })}>{blocked ? t("sa_records_unblock") : t("sa_records_block")}</Button>
                <Button size="sm" variant="destructive" disabled={busy || protectedAccount} onClick={() => { setDeleting(row); setConfirmation(""); }}>{t("sa_records_delete")}</Button>
              </div>
            </div>
          </details>
        );
        const rentals = data.venue_rentals.filter(r => r.venue_id === row.id && r.rental_date === date);
        const events = [...rentals.map(r => ({ time: r.start_time, label: `${t("sa_rental")} · ${r.customer_name} · ${r.hours} ${t("sa_records_hours")} · ${r.is_paid ? t("sa_records_paid") : t("sa_records_unpaid")}` })), ...data.training_sessions.filter(r => r.venue_id === row.id && r.date === date && r.status !== "canceled").map(r => ({ time: r.time, label: `${t("sa_training")} · ${t(STATUS_LABELS[r.status] ?? "sa_records_scheduled")} · ${t("sa_records_end_time_unknown")}` })), ...data.tournament_matches.filter(r => r.venue_id === row.id && r.match_date === date && r.status !== "canceled").map(r => ({ time: r.match_time ?? "", label: `${t("sa_tournament")} · ${r.round_name} · ${t("sa_records_end_time_unknown")}` }))].sort((a,b) => a.time.localeCompare(b.time));
        const allBlockedSlots = ((row.unavailable_slots ?? []) as VenueUnavailableSlot[]).slice().sort((a, b) => a.weekday - b.weekday || minutesOf(a.start) - minutesOf(b.start));
        const dayClosed = [...blockedIntervalsForDate((row.unavailable_slots ?? []) as VenueUnavailableSlot[], date), ...closedIntervalsFromWorkingHours((row.working_hours ?? []) as VenueUnavailableSlot[], date)];
        const { occupied, gaps } = rentalCoverage(data.venue_rentals.filter(r => r.venue_id === row.id) as RentalInterval[], date, dayClosed);
        return <article key={row.id} className={`min-w-0 space-y-3 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${tab === "Friendly games" ? row.status === "completed" ? "border-emerald-500/50 bg-emerald-500/[0.04]" : row.status === "open" ? "border-blue-400/60 ring-1 ring-blue-400/15" : "border-border/70" : colorful ? "border-primary/20" : ""}`}>
          {colorful && <div className={`relative isolate -mx-4 -mt-4 mb-4 flex min-h-20 items-center gap-3 overflow-hidden bg-gradient-to-br ${recordColor} px-4 py-4 text-white ${tab === "Friendly games" && gamePhoto ? "min-h-36 items-end sm:min-h-40" : ""}`}>
            {tab === "Friendly games" ? <>
              <GameCardBackground sport={row.sport ?? "volleyball"} />
              {gamePhoto && <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gamePhoto} alt={gameVenue?.name ?? row.title} loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} />
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-slate-950/10" />
              </>}
              {row.status === "completed" && <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-emerald-900/55" />}
              <span className={`absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${row.status === "completed" ? "border-emerald-200/40 bg-emerald-700 text-white" : row.status === "open" ? "border-blue-200/40 bg-blue-600 text-white" : "border-white/25 bg-slate-900/90 text-white"}`}>
                {row.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : row.status === "open" ? <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" /> : null}
                {t(`community_status_${row.status}` as keyof Dict)}
              </span>
              <span aria-hidden="true" className="rounded-xl border border-white/20 bg-white/10 p-2">{SportIcon({ id: sportToSlug(row.sport ?? "volleyball"), size: 32 })}</span>
              <div className="relative min-w-0"><p className="text-sm font-bold">{row.sport}</p>{gameVenue?.name && <p className="mt-1 text-base font-semibold">{gameVenue.name}</p>}<p className="mt-1 text-xs text-white/90">{row.game_date} · {row.start_time ? formatTime12h(String(row.start_time), lang) : ""}</p></div>
            </> : <>
              <Users aria-hidden="true" className="absolute -bottom-5 end-8 -z-10 h-28 w-28 text-white/15" strokeWidth={1} />
              <ShieldCheck aria-hidden="true" className="h-8 w-8 text-brand-200" />
              <p className="relative text-sm font-semibold">{row.guardian_id ? t("sa_family_member") : t("sa_records_members")}</p>
            </>}
          </div>}
          <div className={tab === "Friendly games" ? "flex flex-col gap-4" : "flex flex-wrap items-start justify-between gap-3"}><div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              {tab === "Members" && <ProfileAvatar name={row.name ?? ""} url={row.avatar_url} avatarId={row.avatar_id} className="h-12 w-12 shrink-0 ring-2 ring-blue-400/30 ring-offset-2 ring-offset-background" />}
              {tab === "Academies" && <AcademyLogo academyId={row.id} name={row.name ?? ""} logoUrl={row.logo_url ?? null} />}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={tab === "Friendly games" ? "w-full break-words text-base font-semibold leading-snug" : "break-words font-semibold"}>{row.name ?? row.title}</h3>
                  {tab === "Members" && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${blocked ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{blocked ? t("sa_blocked") : t("sa_enabled")}</span>}
                  {row.guardian_id && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t("sa_family_member")}</span>}
                  {tab === "Playgrounds" && row.sport_id && sportById.has(row.sport_id) && <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{sportById.get(row.sport_id)}</span>}
                </div>
                {tab === "Members" ? (row.email ? <p className="mt-1 break-all text-sm text-muted-foreground">{row.email}</p> : <p className="mt-1 text-xs text-muted-foreground">{t("sa_no_login")}</p>) : tab === "Friendly games" ? <div className="mt-3 space-y-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${GAME_STATUS_STYLES[row.status] ?? "bg-muted text-muted-foreground"}`}>{t(`community_status_${row.status}` as keyof Dict)}</span>
                  <dl className="space-y-2.5 border-t border-border/60 pt-3 text-sm">
                    <div className="flex items-start gap-2.5"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">{lang === "ar" ? "اليوم والتاريخ" : "Day & date"}</dt><dd className="mt-0.5 font-medium">{row.game_date ? new Intl.DateTimeFormat(lang, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${row.game_date}T00:00:00`)) : "—"}</dd></div></div>
                    <div className="flex items-start gap-2.5"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">{lang === "ar" ? "الوقت" : "Time"}</dt><dd className="mt-0.5 font-medium">{row.start_time ? formatTime12h(String(row.start_time), lang) : "—"}</dd></div></div>
                    <div className="flex items-start gap-2.5"><Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">{t("sa_records_players")}</dt><dd className="mt-0.5 font-medium">{data.friendly_game_participants.filter(p => p.game_id === row.id && !p.is_waitlisted).length} / {row.max_players}</dd></div></div>
                    {(row.share_price != null || row.host_pays) && <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2"><dt className="text-xs text-muted-foreground">{lang === "ar" ? "السعر لكل لاعب" : "Price per player"}</dt><dd className="font-semibold">{formatMoney(row.host_pays ? 0 : Number(row.share_price), lang)}</dd></div>}
                  </dl>
                </div> : <p className="text-sm text-muted-foreground">{tab === "Academies" ? `${row.plan} · ${row.is_trial ? t("sa_trial") : t("sa_records_paid")} · ${data.profiles.filter(p => p.academy_id === row.id).length} ${t("sa_records_accounts")}` : tab === "Tournaments" ? `${academy(row.academy_id)} · ${row.format ?? "—"} · ${row.status} · ${data.tournament_matches.filter(m => m.tournament_id === row.id).length} ${t("sa_records_matches_short")}` : `${academy(row.academy_id)} · ${[row.governorate, row.area, row.address].filter(v => v && String(v).trim()).map(v => String(v).trim()).join(" · ") || t("sa_no_address")}`}</p>}
              </div>
            </div>
          </div>
          <div className={tab === "Friendly games" ? "grid grid-cols-3 gap-2 border-t border-border/60 pt-3" : "flex flex-wrap gap-2"}><Button size="sm" variant="outline" onClick={() => { setMemberInitialTab("overview"); setSelected(row); }}>{t("sa_records_details")}</Button>{tab === "Friendly games" && <Button size="sm" variant="outline" onClick={() => setEditingGame(row)}>{t("sa_records_edit")}</Button>}{tab === "Friendly games" && (row.status === "open" || row.status === "full") && <Button size="sm" variant="destructive" disabled={cancelGame.isPending} onClick={() => setCancellingGame(row)}><Ban className="me-1 h-4 w-4" />{lang === "ar" ? "إلغاء" : "Cancel"}</Button>}{tab === "Members" && <><Button size="sm" variant="outline" disabled={busy || protectedAccount} onClick={() => { setMemberInitialTab("academies"); setSelected(row); }}>{lang === "ar" ? "الأكاديمية والاشتراك" : "Academy & subscription"}</Button><Button size="sm" variant="outline" disabled={busy || protectedAccount} onClick={() => act({ action: "block", id: row.id, blocked: !blocked })}>{blocked ? t("sa_records_unblock") : t("sa_records_block")}</Button><Button size="sm" variant="destructive" disabled={busy || protectedAccount} onClick={() => { setDeleting(row); setConfirmation(""); }}>{t("sa_records_delete")}</Button></>}{tab === "Academies" && <><Button size="sm" className="min-h-11 h-auto whitespace-normal" onClick={() => setTrainingAcademy(row)}>{lang === "ar" ? "مجموعات التدريب" : "Training groups"}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setLogoAcademy(row as Academy)}>{t("sa_academy_logo")}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingAcademy(row as Academy)}>{t("sa_records_edit")}</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { setDeletingAcademy(row as Academy); setConfirmation(""); }}>{t("sa_records_delete")}</Button></>}          {tab === "Playgrounds" && <><Button size="sm" variant="outline" disabled={busy} onClick={() => duplicateVenue(row)}><Copy className="me-1 h-3.5 w-3.5 rtl:me-0 rtl:ms-1" />{t("sa_records_duplicate")}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingVenue({ ...row, lat: row.lat ? String(row.lat) : "", lng: row.lng ? String(row.lng) : "" })}>{t("sa_records_edit")}</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { setDeletingVenue(row); setConfirmation(""); }}>{t("sa_records_delete")}</Button></>}</div></div>
          {tab === "Members" && <dl className="grid grid-cols-1 gap-3 rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50 to-brand-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t("sa_academy")}</dt><dd className="mt-1 break-words font-medium">{academy(row.academy_id)}</dd><dd className="text-xs text-muted-foreground">{row.academy_id ? row.is_active ? t("sa_active_membership") : t("sa_pending_membership") : t("sa_not_joined")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("sa_platform_plan")}</dt><dd className="mt-1 font-medium">{row.member_plan === "premium" ? t("sa_premium") : t("sa_free")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("sa_academy_subscription")}</dt><dd className="mt-1 font-medium">{row.academy_id && row.subscription_sessions > 0 ? `${row.subscription_sessions} ${t("sa_records_sessions")}` : t("sa_no_subscription")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("sa_sessions_attended")}</dt><dd className="mt-1 font-medium">{row.sessions_attended ?? 0}</dd></div>
          </dl>}
          {tab === "Playgrounds" && <div className="space-y-2 text-sm"><p className="font-medium">{t("sa_records_rental_hours_today").replace("{hours}", (occupied / 60).toFixed(1)).replace("{percent}", String(Math.round(occupied / 1440 * 100)))}</p>{events.map((event,i) => <p key={i} className="rounded bg-muted p-2">{formatTime12h(event.time) || t("sa_records_time_unknown")} · {event.label}</p>)}{allBlockedSlots.map((slot,i) => <p key={`blocked-${i}`} className={`flex items-center gap-1.5 rounded p-2 ${weekdayOf(date) === slot.weekday ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}><Ban className="h-3.5 w-3.5 shrink-0" />{t("sa_records_blocked_slot").replace("{slot}", formatBlockedSlot(slot, d => t(`avail_day_${d}` as keyof Dict)))}</p>)}{events.length === 0 && allBlockedSlots.length === 0 && <p>{t("sa_records_no_bookings")}</p>}<p className="text-muted-foreground">{t("sa_records_rental_gaps").replace("{gaps}", gaps.map(g => g.replace(/\d{2}:\d{2}/g, m => formatHour12(m, lang))).join(", ") || t("sa_records_none_gaps"))}</p></div>}
        </article>;
      })}
      </div>
      {recordsPagination}
      </>
      )}
      </div>
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className={tab === "Members" ? "flex h-[90dvh] max-w-4xl flex-col gap-0 overflow-hidden p-0" : "max-w-3xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6"}><DialogHeader className={tab === "Members" ? "shrink-0 px-4 py-4 text-start sm:px-6" : undefined}><DialogTitle className="min-w-0 break-words pe-6">{selected?.name ?? selected?.title ?? t("sa_records_record_details")}</DialogTitle><DialogDescription>{dialogDescription}</DialogDescription></DialogHeader>{selected && (tab === "Members" ? <MemberDetails key={selected.id} member={selected} data={data} initialTab={memberInitialTab} /> : tab === "Academies" ? <AcademyDetails academy={selected} data={data} /> : tab === "Playgrounds" ? <VenueDetails key={selected.id} venue={selected} data={data} /> : tab === "Friendly games" ? <GameDetails game={selected} data={data} /> : <Details row={selected} />)}{tab !== "Members" && tab !== "Academies" && Object.entries(related).map(([label, records]) => <details key={label} open={tab === "Friendly games"}><summary className="cursor-pointer font-medium">{label} ({records?.length ?? 0})</summary><div className="space-y-4 py-3">{records?.map((r: Row) => tab === "Friendly games" ? <GameParticipantRow key={r.id} participant={r} data={data} /> : <Details key={r.id} row={r} />)}</div></details>)}</DialogContent></Dialog>
      <Dialog open={!!deleting} onOpenChange={open => !busy && !open && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>{t("sa_delete_account_title")}</DialogTitle><DialogDescription>{t("sa_delete_account_body").replace("{phrase}", confirmPhrase(deleting) ?? "")}</DialogDescription></DialogHeader><Input aria-label={t("sa_confirmation")} value={confirmation} onChange={e => setConfirmation(e.target.value)} /><Button variant="destructive" disabled={busy || !confirmMatches(confirmation, deleting)} onClick={() => act({ action: "delete", id: deleting!.id, confirmation })}>{busy ? t("sa_deleting") : t("sa_permanently_delete")}</Button></DialogContent></Dialog>
      <AlertDialog open={!!deletingAcademy} onOpenChange={open => !removeAcademy.isPending && !open && setDeletingAcademy(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("sa_delete_academy_title")}</AlertDialogTitle><AlertDialogDescription>{t("sa_delete_academy_body").replace("{name}", deletingAcademy?.name ?? "")}</AlertDialogDescription></AlertDialogHeader><Input aria-label={t("sa_academy")} value={confirmation} onChange={e => setConfirmation(e.target.value)} /><AlertDialogFooter><AlertDialogCancel disabled={removeAcademy.isPending}>{t("sa_cancel")}</AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" disabled={removeAcademy.isPending || confirmation !== deletingAcademy?.name} onClick={async () => { try { await removeAcademy.mutateAsync(deletingAcademy!.id); toast.success(t("sa_academy_deleted")); setDeletingAcademy(null); setConfirmation(""); await cache.invalidateQueries(); } catch (e) { toast.error(e instanceof Error ? e.message : t("sa_deletion_failed")); } }}>{removeAcademy.isPending ? t("sa_deleting") : t("sa_permanently_delete")}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!cancellingGame} onOpenChange={open => { if (!open && !cancelGame.isPending) setCancellingGame(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("community_cancel_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{cancellingGame?.title} — {t("community_cancel_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelGame.isPending}>{t("sa_cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={cancelGame.isPending} onClick={async () => {
              if (!cancellingGame || cancelGame.isPending) return;
              try {
                await cancelGame.mutateAsync(cancellingGame.id);
                setCancellingGame(null);
                setSelected(null);
                toast.success(t("community_game_cancelled"));
                await cache.invalidateQueries({ queryKey: ["platform-records"] });
              } catch (error) {
                toast.error(errorMessage(error, t("common_error")));
              }
            }}>{cancelGame.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t("community_cancel_confirm_btn")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editingGame && <AdminGameEditor game={editingGame as { id: string; title: string }} onClose={() => { setEditingGame(null); setSelected(null); }} />}
      <Dialog open={!!trainingAcademy} onOpenChange={open => { if (!open) setTrainingAcademy(null); }}>
        <DialogContent className="training-mobile max-h-[90dvh] overflow-y-auto p-3 sm:max-w-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="break-words pe-6">{trainingAcademy?.name} · {lang === "ar" ? "مجموعات التدريب" : "Training groups"}</DialogTitle>
            <DialogDescription>{lang === "ar" ? "أضف مجموعة وحدد اسمها والرياضة والنوع والفئة العمرية والمواعيد وسعر الاشتراك والحصة التجريبية." : "Add a group with its own name, sport, gender, age range, schedule, monthly price and trial price."}</DialogDescription>
          </DialogHeader>
          {trainingAcademy && <AcademyTrainingManager key={trainingAcademy.id} academyId={trainingAcademy.id} />}
        </DialogContent>
      </Dialog>
      <AcademyEditDialog academy={editingAcademy} onClose={() => setEditingAcademy(null)} onDeleted={() => { setEditingAcademy(null); cache.invalidateQueries(); }} />
      {logoAcademy && <AcademyLogoDialog academyId={logoAcademy.id} name={logoAcademy.name} open onOpenChange={open => !open && setLogoAcademy(null)} />}
      <TournamentFormDialog open={tournamentFormOpen} onOpenChange={setTournamentFormOpen} tournament={null} sports={(sports ?? []) as { id: string; name: string }[]} venues={(data.venues ?? []) as { id: string; name: string }[]} onSaved={() => cache.invalidateQueries()} />
      <Dialog open={!!editingVenue} onOpenChange={open => !busy && !open && setEditingVenue(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editingVenue?.id ? t("sa_edit_playground") : editingVenue?.duplicate_of ? t("sa_duplicate_playground") : t("sa_add_playground")}</DialogTitle><DialogDescription>{editingVenue?.id || editingVenue?.duplicate_of ? editingVenue.name : t("sa_add_playground_desc")}</DialogDescription></DialogHeader>{editingVenue && <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!isValidSlotList(editingVenue.unavailable_slots)) { toast.error(t("sa_unavail_invalid")); return; } if (!isValidSlotList(editingVenue.working_hours)) { toast.error(t("sa_wh_invalid")); return; } const exactName = editingVenue.name.trim().toLowerCase(); const conflictExists = (data.venues ?? []).some((v: Row) => v.id !== editingVenue.id && String(v.name ?? "").trim().toLowerCase() === exactName && (v.sport_id ?? null) === (editingVenue.sport_id ?? null)); if (exactName && !editingVenue.id && conflictExists) { toast.error(t("sa_venue_name_sport_unique")); return; } act({ action: "venue", ...(editingVenue.id ? { id: editingVenue.id } : {}), academy_id: editingVenue.academy_id ?? null, name: editingVenue.name, capacity: editingVenue.capacity, sport_id: editingVenue.sport_id ?? "", school_name: editingVenue.school_name, rental_cost: editingVenue.rental_cost, rental_hours: editingVenue.rental_hours, location_link: editingVenue.location_link, lat: editingVenue.lat, lng: editingVenue.lng, photos: editingVenue.photos ?? [], cover_url: editingVenue.cover_url, country: editingVenue.country, governorate: editingVenue.governorate, city: editingVenue.area, contact_person: editingVenue.contact_person, contact_phone: editingVenue.contact_phone, court_count: Number(editingVenue.court_count) || 1, unavailable_slots: ((editingVenue.unavailable_slots ?? []) as VenueUnavailableSlot[]).map(s => ({ weekday: Number(s.weekday), start: s.start, end: s.end })), working_hours: ((editingVenue.working_hours ?? []) as VenueUnavailableSlot[]).map(s => ({ weekday: Number(s.weekday), start: s.start, end: s.end })) }); }}>
        <label className="block text-sm">{t("sa_academy")}
          <NativeSelect className="mt-1 w-full rounded border bg-background p-2" value={editingVenue.academy_id ?? ""} onChange={e => setEditingVenue({ ...editingVenue, academy_id: e.target.value || null })}>
            <option value="">{t("sa_unassigned")}</option>
            {data.academies.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
          </NativeSelect>
          <span className="mt-1 block text-xs text-muted-foreground">{t("sa_pool_hint")}</span>
        </label>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Camera className="h-4 w-4 text-primary" />{t("sa_photo")}</p>
          <p className="text-xs text-muted-foreground">{t("sa_photo_hint")}</p>
          {(editingVenue.photos ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(editingVenue.photos ?? []).map((url, idx) => (
                <div key={url} className="group relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border bg-muted/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${editingVenue.name ?? ""} ${idx + 1}`} className="h-full w-full object-cover" />
                  {url === (editingVenue.cover_url ?? (editingVenue.photos ?? [])[0]) && <span className="absolute start-0 top-0 rounded-br bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold">{t("sa_photo_card")}</span>}
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/40 to-transparent p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <Button type="button" variant="secondary" size="icon" className="h-6 w-6" aria-label={t("sa_photo_set_card")} onClick={() => setCardPhoto(url)}><Star className="h-3 w-3" /></Button>
                    <Button type="button" variant="destructive" size="icon" className="h-6 w-6" aria-label={t("sa_photo_remove")} onClick={() => setRemovePhoto(url)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
            <Button type="button" variant="outline" size="sm" disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()}>
              {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadingPhoto ? t("sa_photo_uploading") : t("sa_photo_upload")}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("sa_playground_name")}</Label>
            <Input required value={editingVenue.name} onChange={e => setEditingVenue({ ...editingVenue, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("sa_sport")}</Label>
            <SportCombobox
              sports={sportOptions}
              value={editingVenue.sport_id}
              onSelect={handleSportSelect}
              placeholder={t("sa_sport_search")}
            />
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
              <NativeSelect aria-label={t("sa_unavail_day")} className="rounded border bg-background p-2 text-sm" value={String(slot.weekday)} onChange={e => setEditingVenue(c => c ? ({ ...c, unavailable_slots: (c.unavailable_slots ?? []).map((s, i) => i === idx ? { ...s, weekday: Number(e.target.value) } : s) }) : c)}>
                {[0, 1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d} data-sort={d}>{t(`avail_day_${d}` as keyof Dict)}</option>)}
              </NativeSelect>
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
              <NativeSelect aria-label={t("sa_unavail_day")} className="rounded border bg-background p-2 text-sm" value={String(slot.weekday)} onChange={e => setEditingVenue(c => c ? ({ ...c, working_hours: (c.working_hours ?? []).map((s, i) => i === idx ? { ...s, weekday: Number(e.target.value) } : s) }) : c)}>
                {[0, 1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d} data-sort={d}>{t(`avail_day_${d}` as keyof Dict)}</option>)}
              </NativeSelect>
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

function SportCombobox({
  sports,
  value,
  onSelect,
  placeholder,
}: {
  sports: Row[];
  value: string | null;
  onSelect: (sportId: string | null) => void;
  placeholder: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = value ? sports.find((s) => s.id === value) : null;
  const filtered = query
    ? sports.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    : sports;

  const select = (id: string | null) => {
    onSelect(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between font-normal"
        >
          <span dir="auto" className="truncate text-start">
            {selected ? selected.name : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="z-[60] w-[var(--radix-popover-trigger-width)] overflow-hidden p-0">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-9 rounded-none border-0 border-b ps-8 focus-visible:ring-0"
            dir="auto"
          />
        </div>
        <div className="max-h-[min(22rem,60dvh)] overscroll-contain overflow-auto p-1">
          <SortedOptions>
            <button
              type="button"
              onClick={() => select(null)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-start text-sm hover:bg-accent",
                value == null && "bg-accent",
              )}
              dir="auto"
            >
              <span className="text-muted-foreground">{t("sa_unassigned")}</span>
              {value == null && <Check className="h-4 w-4 shrink-0 opacity-70" />}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {t("sa_records_empty")}
              </p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => select(s.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent",
                    value === s.id && "bg-accent",
                  )}
                  dir="auto"
                >
                  <span className="truncate">{s.name}</span>
                  {value === s.id && <Check className="h-4 w-4 shrink-0 opacity-70" />}
                </button>
              ))
            )}
          </SortedOptions>
        </div>
      </PopoverContent>
    </Popover>
  );
}
