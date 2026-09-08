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
import { rentalCoverage, type RentalInterval } from "@/lib/admin-schedule";
import { PLATFORM_ADMIN_EMAIL, matchesAccountEmail } from "@/lib/platform-admin";
import { useSuperAdminDeleteAcademy } from "@/lib/queries";
import type { Academy } from "@/lib/types";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { AcademyEditDialog } from "./academy-edit-dialog";
import { LocationFields } from "@/components/shared/location-fields";
import { COUNTRIES, COUNTRIES_AR } from "@/lib/locations";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";

type Row = Record<string, any>;
type Records = Record<string, Row[]>;
const tabs = ["Members", "Academies", "Friendly games", "Playgrounds"] as const;
/** Deletion confirmation phrase: account email, else member email, else the
 * family member's name (children have no login or email). */
function confirmPhrase(row: Row | null): string | null {
  if (!row) return null;
  return row.account_email ?? row.email ?? row.name ?? null;
}
function confirmMatches(confirmation: string, row: Row | null): boolean {
  return matchesAccountEmail(confirmation, confirmPhrase(row));
}
function Details({ row }: { row: Row }) {
  return <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(row).map(([key, value]) => <div key={key} className="min-w-0 rounded-lg bg-muted/40 p-3"><dt className="text-xs capitalize text-muted-foreground">{key.replaceAll("_", " ")}</dt><dd className="mt-1 break-words text-sm">{value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>;
}
function AcademyMemberRow({ member }: { member: Row }) {
  const blocked = member.banned_until && new Date(member.banned_until) > new Date();
  const status = blocked ? "Blocked" : member.is_active ? "Active" : "Inactive";
  return <details className="rounded-lg border px-3 py-2">
    <summary className="cursor-pointer text-sm marker:text-muted-foreground">
      <span className="inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 align-middle">
        <ProfileAvatar name={member.name ?? ""} url={member.avatar_url} className="h-7 w-7 shrink-0" />
        <span className="truncate font-medium">{member.name || "Unnamed member"}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{status}</span>
      </span>
    </summary>
    <div className="pt-3"><Details row={{
      Email: member.email || "No login account",
      Phone: member.phone || "Not provided",
      Membership: member.membership_type === "half" ? "Half" : "Full",
      "Platform plan": member.member_plan === "premium" ? "Premium" : "Free",
      "Subscription sessions": member.subscription_sessions,
      "Sessions attended": member.sessions_attended,
    }} /></div>
  </details>;
}
function AcademyDetails({ academy, data }: { academy: Row; data: Records }) {
  const people = data.profiles.filter(row => row.academy_id === academy.id);
  const members = people.filter(row => row.role === "member");
  const admins = people.filter(row => row.role === "admin");
  const branches = data.academy_branches.filter(row => row.academy_id === academy.id);
  const plans = data.membership_plans.filter(row => row.academy_id === academy.id);
  const venues = data.venues.filter(row => row.academy_id === academy.id);
  const planName = ({ starter: "Free", plus: "Plus", elite: "Enterprise" } as Record<string, string>)[academy.plan] ?? "Not set";
  const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not set";
  const trialExpired = academy.trial_ends_at && new Date(academy.trial_ends_at) < new Date();
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2 text-xs">{[planName, academy.is_trial ? trialExpired ? "Trial expired" : "Trial" : "Non-trial", academy.is_public ? "Public listing" : "Private listing"].map(label => <span key={label} className="rounded-full bg-muted px-3 py-1 font-medium">{label}</span>)}</div>
    {academy.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{academy.description}</p>}
    <dl className="grid grid-cols-3 gap-2 text-center">{[["Members", members.length], ["Branches", branches.length], ["Playgrounds", venues.length]].map(([label, count]) => <div key={label} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold">{count}</dd></div>)}</dl>
    <section className="space-y-2"><h3 className="text-sm font-semibold">Location</h3><Details row={{ Country: academy.country || "Not provided", Governorate: academy.governorate || "Not provided", "City / area": academy.area || "Not provided", Address: academy.address || "Not provided" }} /></section>
    <section className="space-y-2"><h3 className="text-sm font-semibold">Subscription & settings</h3><Details row={{ "Academy plan": planName, "Created": date(academy.created_at), ...(academy.is_trial ? { "Trial ends": date(academy.trial_ends_at) } : {}), "Session bookings": academy.session_booking_enabled ? "Enabled" : "Disabled", ...(academy.session_booking_enabled ? { "Platform fee": `${academy.platform_fee_percent ?? 5}%` } : {}) }} /></section>
    <section className="space-y-2"><h3 className="text-sm font-semibold">Academy administrators</h3>{admins.length ? admins.map(admin => <div key={admin.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{admin.name}</p><p className="break-all text-muted-foreground">{admin.email}</p>{admin.phone && <p className="text-muted-foreground" dir="ltr">{admin.phone}</p>}</div>) : <p className="text-sm text-muted-foreground">No administrator assigned.</p>}</section>
    <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">Members ({members.length})</summary><div className="mt-3 space-y-2">{members.length ? members.map(member => <AcademyMemberRow key={member.id} member={member} />) : <p className="text-sm text-muted-foreground">No members yet.</p>}</div></details>
    {[
      { label: "Branches", rows: branches, fields: (row: Row) => ({ Address: row.address || "Not provided", Location: [row.country, row.governorate, row.area].filter(Boolean).join(" · ") || "Not provided", Phone: row.phone || "Not provided", "Main branch": row.is_main ? "Yes" : "No" }) },
      { label: "Membership plans", rows: plans, fields: (row: Row) => ({ Sessions: row.sessions_count, "Price (EGP)": row.price ?? "Not set", Status: row.is_active ? "Active" : "Inactive" }) },
      { label: "Playgrounds", rows: venues, fields: (row: Row) => ({ Address: row.address || "Not provided", Capacity: row.capacity ?? "Not set", "Rental cost (EGP / hour)": row.rental_cost ?? "Not set", "Rental hours": row.rental_hours ?? "Not set" }) },
    ].map(group => <details key={group.label} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">{group.label} ({group.rows.length})</summary><div className="mt-3 space-y-2">{group.rows.length ? group.rows.map(row => <details key={row.id} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{row.name}</summary><div className="mt-3"><Details row={group.fields(row)} /></div></details>) : <p className="text-sm text-muted-foreground">None added yet.</p>}</div></details>)}
  </div>;
}
function MemberDetails({ member, data }: { member: Row; data: Records }) {
  const payments = data.payments.filter(r => r.member_id === member.id).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const attendance = data.attendance.filter(r => r.member_id === member.id);
  const games = data.friendly_game_participants.filter(r => r.member_id === member.id);
  const blocked = member.banned_until && new Date(member.banned_until) > new Date();
  const summary = {
    Email: member.email || (member.guardian_id ? "No login account" : "Not provided"),
    Phone: member.phone || "Not provided",
    Academy: data.academies.find(a => a.id === member.academy_id)?.name ?? "Independent",
    "Account status": blocked ? "Blocked" : "Enabled",
    "Membership status": member.is_active ? "Active" : "Inactive",
    "Membership type": member.membership_type === "half" ? "Half" : "Full",
    "Platform plan": member.member_plan === "premium" ? "Premium" : "Free",
    "Subscription sessions": member.subscription_sessions,
    "Sessions attended": member.sessions_attended,
    "Joined": member.join_date ?? member.created_at?.slice(0, 10) ?? "Unknown",
    ...(member.member_plan === "premium" ? { "Premium expires": member.premium_expires_at?.slice(0, 10) ?? "No expiry" } : {}),
  };
  return <div className="space-y-5">
    <Details row={summary} />
    <details><summary className="cursor-pointer font-medium">Payment history ({payments.length})</summary>
      <div className="mt-3 space-y-2">{payments.length === 0 && <p className="text-sm text-muted-foreground">No payments recorded.</p>}{payments.map(payment => <div key={payment.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{payment.payment_date} · {payment.amount} · {String(payment.method ?? "").replaceAll("_", " ")}</p><p className="text-muted-foreground">{payment.subscription_sessions} sessions{payment.notes ? ` · ${payment.notes}` : ""}</p></div>)}</div>
    </details>
    <details><summary className="cursor-pointer font-medium">Activity ({attendance.filter(r => r.is_present).length} attendances · {games.length} game registrations)</summary>
      <div className="mt-3 space-y-2 text-sm">{attendance.length === 0 && games.length === 0 && <p className="text-muted-foreground">No activity recorded.</p>}{attendance.map(record => {
        const session = data.training_sessions.find(item => item.id === record.session_id);
        return <p key={record.id} className="rounded-lg border p-3">{session?.date ?? "Unknown date"} · Training · {record.is_present ? "Attended" : "Absent"}</p>;
      })}{games.map(record => {
        const game = data.friendly_games.find(item => item.id === record.game_id);
        return <p key={record.id} className="rounded-lg border p-3">{game?.game_date ?? "Unknown date"} · {game?.title ?? "Friendly game"} · {record.is_waitlisted ? "Waitlisted" : record.role === "organizer" ? "Organizer" : "Player"}</p>;
      })}</div>
    </details>
  </div>;
}
export function PlatformRecords() {
  const cache = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading, error, refetch } = useQuery<Records>({ queryKey: ["platform-records"], queryFn: async () => {
    const response = await fetch("/api/platform-admin", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  } });
  const [tab, setTab] = useState<typeof tabs[number]>("Members");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`);
  const [selected, setSelected] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingVenue, setDeletingVenue] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [editingAcademy, setEditingAcademy] = useState<Academy | null>(null);
  const [editingVenue, setEditingVenue] = useState<Row | null>(null);
  const [deletingAcademy, setDeletingAcademy] = useState<Academy | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const removeAcademy = useSuperAdminDeleteAcademy();
  const requestedTab = searchParams.get("tab");
  useEffect(() => {
    setTab(tabs.find(item => item === requestedTab) ?? "Members");
    setSearch("");
    setSelected(null);
    setEditingAcademy(null);
    setDeletingAcademy(null);
    setDeletingVenue(null);
  }, [requestedTab]);
  const act = async (body: Row) => {
    setBusy(true);
    try {
      const response = await fetch("/api/platform-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success(body.action === "venue" ? "Playground updated" : body.action === "delete_venue" ? "Playground deleted" : body.action === "delete" ? "Account deleted" : "Account updated");
      if (body.action === "venue") setEditingVenue(null);
      setEditing(null); setDeleting(null); setDeletingVenue(null); setConfirmation("");
      await cache.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  };
  if (isLoading) return <Card><CardContent className="p-6">Loading platform records…</CardContent></Card>;
  if (error || !data) return <Card><CardContent className="p-6"><p role="alert">{error?.message ?? "Could not load records"}</p><Button onClick={() => refetch()}>Retry</Button></CardContent></Card>;
  const academy = (id: string) => data.academies.find(a => a.id === id)?.name ?? (id ? "Academy unavailable" : "Independent");
  const source = tab === "Members" ? data.profiles : tab === "Academies" ? data.academies : tab === "Friendly games" ? data.friendly_games : data.venues;
  const rows = source.filter(row => [row.name, row.email, row.title, row.phone, row.id, academy(row.academy_id)].join(" ").toLowerCase().includes(search.toLowerCase()));
  const related = selected ? (tab === "Members" ? { Payments: data.payments.filter(r => r.member_id === selected.id), Attendance: data.attendance.filter(r => r.member_id === selected.id), Games: data.friendly_game_participants.filter(r => r.member_id === selected.id) } : tab === "Academies" ? { Members: data.profiles.filter(r => r.academy_id === selected.id), Branches: data.academy_branches.filter(r => r.academy_id === selected.id), Plans: data.membership_plans.filter(r => r.academy_id === selected.id), Playgrounds: data.venues.filter(r => r.academy_id === selected.id) } : tab === "Friendly games" ? { Participants: data.friendly_game_participants.filter(r => r.game_id === selected.id).map(r => ({ ...r, name: data.profiles.find(p => p.id === r.member_id)?.name })) } : {}) : {};
  return <Card>
    <CardHeader><CardTitle>Platform management</CardTitle><p className="text-sm text-muted-foreground">{data.profiles.length} accounts · {data.academies.length} academies · {data.friendly_games.length} games · {data.venues.length} playgrounds</p></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Platform records">{tabs.map(item => <Button key={item} role="tab" aria-selected={tab === item} variant={tab === item ? "default" : "outline"} onClick={() => { router.push(`/admin?tab=${encodeURIComponent(item)}`, { scroll: false }); }}>{item}</Button>)}</div>
      <div className="flex flex-wrap gap-2"><Input className="max-w-sm" aria-label="Search records" placeholder="Search name, email, phone or academy…" value={search} onChange={e => setSearch(e.target.value)} />{tab === "Playgrounds" && <Input className="w-auto" type="date" aria-label="Schedule date" value={date} onChange={e => setDate(e.target.value)} />}{tab === "Playgrounds" && <Button disabled={busy} onClick={() => setEditingVenue({ name: "", address: "", capacity: "", sport_id: "", school_name: "", rental_cost: "", rental_hours: "1", country: "", governorate: "", area: "", contact_person: "", contact_phone: "", lat: "", lng: "", academy_id: null })}><Plus className="mr-1 h-4 w-4" />Add playground</Button>}<Button variant="outline" onClick={() => refetch()}>Refresh</Button></div>
      {tab === "Playgrounds" && <p className="text-sm text-muted-foreground">Schedules use recorded local times. Rentals have known durations; training and tournament end times are not stored. Gaps are unbooked rental time, not confirmed availability. Opening hours and friendly-game venue links are not recorded.</p>}
      <p className="text-xs text-muted-foreground">{rows.length} records</p>
      <div className="max-h-[650px] space-y-3 overflow-auto">
      {rows.length === 0 && <p className="py-8 text-center text-muted-foreground">No matching records.</p>}
      {rows.map(row => {
        const blocked = row.banned_until && new Date(row.banned_until) > new Date();
        const protectedAccount = row.email?.toLowerCase() === PLATFORM_ADMIN_EMAIL;
        const rentals = data.venue_rentals.filter(r => r.venue_id === row.id && r.rental_date === date);
        const events = [...rentals.map(r => ({ time: r.start_time, label: `Rental · ${r.customer_name} · ${r.hours} hours · ${r.is_paid ? "Paid" : "Unpaid"}` })), ...data.training_sessions.filter(r => r.venue_id === row.id && r.date === date && r.status !== "canceled").map(r => ({ time: r.time, label: `Training · ${r.status} · end time unknown` })), ...data.tournament_matches.filter(r => r.venue_id === row.id && r.match_date === date && r.status !== "canceled").map(r => ({ time: r.match_time ?? "", label: `Tournament · ${r.round_name} · end time unknown` }))].sort((a,b) => a.time.localeCompare(b.time));
        const { occupied, gaps } = rentalCoverage(data.venue_rentals.filter(r => r.venue_id === row.id) as RentalInterval[], date);
        return <article key={row.id} className="rounded-xl border p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              {tab === "Members" && <ProfileAvatar name={row.name ?? ""} url={row.avatar_url} className="h-10 w-10 shrink-0" />}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words font-semibold">{row.name ?? row.title}</h3>
                  {tab === "Members" && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${blocked ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{blocked ? "Blocked" : "Account enabled"}</span>}
                  {row.guardian_id && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Family member</span>}
                </div>
                {tab === "Members" ? (row.email ? <p className="mt-1 break-all text-sm text-muted-foreground">{row.email}</p> : <p className="mt-1 text-xs text-muted-foreground">No login account</p>) : <p className="text-sm text-muted-foreground">{tab === "Academies" ? `${row.plan} · ${row.is_trial ? "Trial" : "Paid"} · ${data.profiles.filter(p => p.academy_id === row.id).length} accounts` : tab === "Friendly games" ? `${row.game_date} ${row.start_time} · ${row.sport} · ${row.status} · ${data.friendly_game_participants.filter(p => p.game_id === row.id && !p.is_waitlisted).length}/${row.max_players} players` : `${academy(row.academy_id)} · ${row.address ?? "No address"}`}</p>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setSelected(row)}>Details</Button>{tab === "Members" && <><Button size="sm" variant="outline" disabled={busy || protectedAccount} onClick={() => setEditing({ ...row })}>Membership</Button><Button size="sm" variant="outline" disabled={busy || protectedAccount} onClick={() => act({ action: "block", id: row.id, blocked: !blocked })}>{blocked ? "Unblock" : "Block"}</Button><Button size="sm" variant="destructive" disabled={busy || protectedAccount} onClick={() => { setDeleting(row); setConfirmation(""); }}>Delete</Button></>}{tab === "Academies" && <><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingAcademy(row as Academy)}>Edit</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { setDeletingAcademy(row as Academy); setConfirmation(""); }}>Delete</Button></>}          {tab === "Playgrounds" && <><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingVenue({ ...row, lat: row.lat ? String(row.lat) : "", lng: row.lng ? String(row.lng) : "" })}>Edit</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { setDeletingVenue(row); setConfirmation(""); }}>Delete</Button></>}</div></div>
          {tab === "Members" && <dl className="grid grid-cols-1 gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">Academy</dt><dd className="mt-1 break-words font-medium">{academy(row.academy_id)}</dd><dd className="text-xs text-muted-foreground">{row.academy_id ? row.is_active ? "Active academy membership" : "Pending / inactive membership" : "Not joined to an academy"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Platform plan</dt><dd className="mt-1 font-medium">{row.member_plan === "premium" ? "Premium" : "Free"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Academy subscription</dt><dd className="mt-1 font-medium">{row.academy_id && row.subscription_sessions > 0 ? `${row.membership_type === "half" ? "Half" : "Full"} · ${row.subscription_sessions} sessions` : "No subscription"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Sessions attended</dt><dd className="mt-1 font-medium">{row.sessions_attended ?? 0}</dd></div>
          </dl>}
          {tab === "Playgrounds" && <div className="space-y-2 text-sm"><p className="font-medium">{(occupied / 60).toFixed(1)} rental hours / 24 hours ({Math.round(occupied / 1440 * 100)}% rental occupation)</p>{events.map((event,i) => <p key={i} className="rounded bg-muted p-2">{event.time.slice(0,5) || "Time unknown"} · {event.label}</p>)}{events.length === 0 && <p>No bookings recorded for this date.</p>}<p className="text-muted-foreground">Rental gaps: {gaps.join(", ") || "None"}</p></div>}
        </article>;
      })}</div>
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.name ?? selected?.title ?? "Record details"}</DialogTitle><DialogDescription>{tab === "Members" ? "Contact, membership and activity" : tab === "Academies" ? "Academy overview, subscription and people" : "Stored record and related activity"}</DialogDescription></DialogHeader>{selected && (tab === "Members" ? <MemberDetails member={selected} data={data} /> : tab === "Academies" ? <AcademyDetails academy={selected} data={data} /> : <Details row={selected} />)}{tab !== "Members" && tab !== "Academies" && Object.entries(related).map(([label, records]) => <details key={label}><summary className="cursor-pointer font-medium">{label} ({records?.length ?? 0})</summary><div className="space-y-4 py-3">{records?.map((r: Row) => label === "Members" ? <AcademyMemberRow key={r.id} member={r} /> : <Details key={r.id} row={r} />)}</div></details>)}</DialogContent></Dialog>
      <Dialog open={!!editing} onOpenChange={open => !busy && !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>Edit membership</DialogTitle><DialogDescription>{editing?.name} · {editing?.email}</DialogDescription></DialogHeader>{editing && <form className="space-y-4" onSubmit={e => { e.preventDefault(); act({ action: "membership", id: editing.id, membership_type: editing.membership_type, subscription_sessions: Number(editing.subscription_sessions), member_plan: editing.member_plan, premium_expires_at: editing.premium_expires_at ? new Date(editing.premium_expires_at).toISOString() : null, is_active: editing.is_active }); }}>
        <label className="block text-sm">Academy membership<select className="mt-1 w-full rounded border bg-background p-2" value={editing.membership_type} onChange={e => setEditing({ ...editing, membership_type: e.target.value })}><option value="full">Full</option><option value="half">Half</option></select></label>
        <label className="block text-sm">Subscription sessions<Input type="number" min="0" max="10000" required value={editing.subscription_sessions} onChange={e => setEditing({ ...editing, subscription_sessions: e.target.value })} /></label>
        <label className="block text-sm">Platform plan<select className="mt-1 w-full rounded border bg-background p-2" value={editing.member_plan} onChange={e => setEditing({ ...editing, member_plan: e.target.value })}><option value="free">Free</option><option value="premium">Premium</option></select></label>
        <label className="block text-sm">Premium expiry (UTC; blank means no expiry)<Input type="date" value={editing.premium_expires_at?.slice(0,10) ?? ""} onChange={e => setEditing({ ...editing, premium_expires_at: e.target.value })} /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />Active academy membership</label>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save membership"}</Button>
      </form>}</DialogContent></Dialog>
      <Dialog open={!!deleting} onOpenChange={open => !busy && !open && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>Permanently delete account?</DialogTitle><DialogDescription>This removes the login and related records according to database deletion rules. This cannot be undone. Type {confirmPhrase(deleting)} to confirm.</DialogDescription></DialogHeader><Input aria-label="Confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} /><Button variant="destructive" disabled={busy || !confirmMatches(confirmation, deleting)} onClick={() => act({ action: "delete", id: deleting!.id, confirmation })}>{busy ? "Deleting…" : "Permanently delete"}</Button></DialogContent></Dialog>
      <AlertDialog open={!!deletingAcademy} onOpenChange={open => !removeAcademy.isPending && !open && setDeletingAcademy(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Permanently delete academy?</AlertDialogTitle><AlertDialogDescription>This removes the academy and every account and record linked to it (members, sessions, games, payments, branches, sports). This cannot be undone. Type {deletingAcademy?.name} to confirm.</AlertDialogDescription></AlertDialogHeader><Input aria-label="Academy name confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} /><AlertDialogFooter><AlertDialogCancel disabled={removeAcademy.isPending}>Cancel</AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" disabled={removeAcademy.isPending || confirmation !== deletingAcademy?.name} onClick={async () => { try { await removeAcademy.mutateAsync(deletingAcademy!.id); toast.success("Academy deleted"); setDeletingAcademy(null); setConfirmation(""); await cache.invalidateQueries(); } catch (e) { toast.error(e instanceof Error ? e.message : "Deletion failed"); } }}>{removeAcademy.isPending ? "Deleting…" : "Permanently delete"}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AcademyEditDialog academy={editingAcademy} onClose={() => setEditingAcademy(null)} onDeleted={() => { setEditingAcademy(null); cache.invalidateQueries(); }} />
      <Dialog open={!!editingVenue} onOpenChange={open => !busy && !open && setEditingVenue(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editingVenue?.id ? "Edit playground" : "Add playground"}</DialogTitle><DialogDescription>{editingVenue?.id ? editingVenue.name : "Create a playground in the platform pool or assign it to an academy."}</DialogDescription></DialogHeader>{editingVenue && <form className="space-y-4" onSubmit={e => { e.preventDefault(); act({ action: "venue", ...(editingVenue.id ? { id: editingVenue.id } : {}), academy_id: editingVenue.academy_id ?? null, name: editingVenue.name, address: editingVenue.address, capacity: editingVenue.capacity, sport_id: editingVenue.sport_id ?? "", school_name: editingVenue.school_name, rental_cost: editingVenue.rental_cost, rental_hours: editingVenue.rental_hours, country: editingVenue.country, governorate: editingVenue.governorate, city: editingVenue.area, contact_person: editingVenue.contact_person, contact_phone: editingVenue.contact_phone }); }}>
        <label className="block text-sm">Academy
          <select className="mt-1 w-full rounded border bg-background p-2" value={editingVenue.academy_id ?? ""} onChange={e => setEditingVenue({ ...editingVenue, academy_id: e.target.value || null })}>
            <option value="">Unassigned (platform pool)</option>
            {data.academies.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">Leave as pool so academies can claim this playground.</span>
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Playground name</Label>
            <Input required value={editingVenue.name} onChange={e => setEditingVenue({ ...editingVenue, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Sport</Label>
            <Input value={editingVenue.sport_id ?? ""} onChange={e => setEditingVenue({ ...editingVenue, sport_id: e.target.value })} placeholder="Sport UUID (leave blank for none)" />
          </div>
        </div>         <div className="space-y-2">
           <Label>Address</Label>
           <Input value={editingVenue.address ?? ""} onChange={e => setEditingVenue({ ...editingVenue, address: e.target.value })} placeholder="e.g. 123 Street Name, City" />
         </div>         <LocationFields
           country={editingVenue.country ?? ""}
           governorate={editingVenue.governorate ?? ""}
           city={editingVenue.area ?? ""}
           onCountryChange={(v) => setEditingVenue((current) => current && ({ ...current, country: v, governorate: "", area: "" }))}
           onGovernorateChange={(v) => setEditingVenue((current) => current && ({ ...current, governorate: v, area: "" }))}
           onCityChange={(v) => setEditingVenue((current) => current && ({ ...current, area: v }))}
           governorateLabel="Governorate"
           cityLabel="City / Area"
         />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Capacity</Label>
            <Input type="number" min="0" value={editingVenue.capacity ?? ""} onChange={e => setEditingVenue({ ...editingVenue, capacity: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Rented school / owner</Label>
            <Input value={editingVenue.school_name ?? ""} onChange={e => setEditingVenue({ ...editingVenue, school_name: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Rental cost (EGP)</Label>
            <Input type="number" min="0" step="0.01" value={editingVenue.rental_cost ?? ""} onChange={e => setEditingVenue({ ...editingVenue, rental_cost: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Rental hours</Label>
            <Input type="number" min="0" step="0.5" value={editingVenue.rental_hours ?? "1"} onChange={e => setEditingVenue({ ...editingVenue, rental_hours: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Contact person</Label>
            <Input value={editingVenue.contact_person ?? ""} onChange={e => setEditingVenue({ ...editingVenue, contact_person: e.target.value })} placeholder="Name of contact person" />
          </div>
          <div className="space-y-2">
            <Label>Contact phone</Label>
            <Input value={editingVenue.contact_phone ?? ""} onChange={e => setEditingVenue({ ...editingVenue, contact_phone: e.target.value })} placeholder="Phone number" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setEditingVenue(null)}>Cancel</Button>
          <Button type="submit" disabled={busy} className="ml-auto">{busy ? "Saving…" : "Save playground"}</Button>
        </div>
      </form>}</DialogContent></Dialog>
      <Dialog open={!!deletingVenue} onOpenChange={open => !busy && !open && setDeletingVenue(null)}><DialogContent><DialogHeader><DialogTitle>Permanently delete playground?</DialogTitle><DialogDescription>This removes the playground. Rentals using this playground will keep working but without the playground name. Type {deletingVenue?.name} to confirm.</DialogDescription></DialogHeader><Input aria-label="Playground name confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} /><Button variant="destructive" disabled={busy || confirmation !== deletingVenue?.name} onClick={() => act({ action: "delete_venue", id: deletingVenue!.id, confirmation })}>{busy ? "Deleting…" : "Permanently delete"}</Button></DialogContent></Dialog>
    </CardContent>
  </Card>;
}
