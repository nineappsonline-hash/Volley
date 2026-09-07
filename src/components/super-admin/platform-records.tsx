"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { rentalCoverage, type RentalInterval } from "@/lib/admin-schedule";
import { PLATFORM_ADMIN_EMAIL } from "@/lib/platform-admin";

type Row = Record<string, any>;
type Records = Record<string, Row[]>;
const tabs = ["Members", "Academies", "Friendly games", "Playgrounds"] as const;
function Details({ row }: { row: Row }) {
  return <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(row).map(([key, value]) => <div key={key} className="min-w-0 rounded-lg bg-muted/40 p-3"><dt className="text-xs capitalize text-muted-foreground">{key.replaceAll("_", " ")}</dt><dd className="mt-1 break-words text-sm">{value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>;
}
function MemberDetails({ member, data }: { member: Row; data: Records }) {
  const payments = data.payments.filter(r => r.member_id === member.id).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const attendance = data.attendance.filter(r => r.member_id === member.id);
  const games = data.friendly_game_participants.filter(r => r.member_id === member.id);
  const blocked = member.banned_until && new Date(member.banned_until) > new Date();
  const summary = {
    Email: member.email,
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
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const requestedTab = searchParams.get("tab");
  useEffect(() => {
    setTab(tabs.find(item => item === requestedTab) ?? "Members");
    setSearch("");
    setSelected(null);
  }, [requestedTab]);
  const act = async (body: Row) => {
    setBusy(true);
    try {
      const response = await fetch("/api/platform-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success("Account updated");
      setEditing(null); setDeleting(null); setConfirmation("");
      await cache.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  };
  if (isLoading) return <Card><CardContent className="p-6">Loading platform records…</CardContent></Card>;
  if (error || !data) return <Card><CardContent className="p-6"><p role="alert">{error?.message ?? "Could not load records"}</p><Button onClick={() => refetch()}>Retry</Button></CardContent></Card>;
  const academy = (id: string) => data.academies.find(a => a.id === id)?.name ?? "Independent";
  const source = tab === "Members" ? data.profiles : tab === "Academies" ? data.academies : tab === "Friendly games" ? data.friendly_games : data.venues;
  const rows = source.filter(row => [row.name, row.email, row.title, row.phone, row.id, academy(row.academy_id)].join(" ").toLowerCase().includes(search.toLowerCase()));
  const related = selected ? (tab === "Members" ? { Payments: data.payments.filter(r => r.member_id === selected.id), Attendance: data.attendance.filter(r => r.member_id === selected.id), Games: data.friendly_game_participants.filter(r => r.member_id === selected.id) } : tab === "Academies" ? { Members: data.profiles.filter(r => r.academy_id === selected.id), Branches: data.academy_branches.filter(r => r.academy_id === selected.id), Plans: data.membership_plans.filter(r => r.academy_id === selected.id), Playgrounds: data.venues.filter(r => r.academy_id === selected.id) } : tab === "Friendly games" ? { Participants: data.friendly_game_participants.filter(r => r.game_id === selected.id).map(r => ({ ...r, name: data.profiles.find(p => p.id === r.member_id)?.name })) } : {}) : {};
  return <Card>
    <CardHeader><CardTitle>Platform management</CardTitle><p className="text-sm text-muted-foreground">{data.profiles.length} accounts · {data.academies.length} academies · {data.friendly_games.length} games · {data.venues.length} playgrounds</p></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Platform records">{tabs.map(item => <Button key={item} role="tab" aria-selected={tab === item} variant={tab === item ? "default" : "outline"} onClick={() => { router.push(`/admin?tab=${encodeURIComponent(item)}`, { scroll: false }); }}>{item}</Button>)}</div>
      <div className="flex flex-wrap gap-2"><Input className="max-w-sm" aria-label="Search records" placeholder="Search name, email, phone or academy…" value={search} onChange={e => setSearch(e.target.value)} />{tab === "Playgrounds" && <Input className="w-auto" type="date" aria-label="Schedule date" value={date} onChange={e => setDate(e.target.value)} />}<Button variant="outline" onClick={() => refetch()}>Refresh</Button></div>
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
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{row.name ?? row.title}</h3><p className="text-sm text-muted-foreground">{tab === "Members" ? `${row.email} · ${academy(row.academy_id)} · ${row.role} · ${blocked ? "Blocked" : row.is_active ? "Active" : "Inactive"} · ${row.member_plan} · ${row.membership_type} · ${row.sessions_attended}/${row.subscription_sessions} sessions` : tab === "Academies" ? `${row.plan} · ${row.is_trial ? "Trial" : "Paid"} · ${data.profiles.filter(p => p.academy_id === row.id).length} accounts` : tab === "Friendly games" ? `${row.game_date} ${row.start_time} · ${row.sport} · ${row.status} · ${data.friendly_game_participants.filter(p => p.game_id === row.id && !p.is_waitlisted).length}/${row.max_players} players` : `${academy(row.academy_id)} · ${row.address ?? "No address"}`}</p></div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setSelected(row)}>Details</Button>{tab === "Members" && <><Button size="sm" variant="outline" disabled={busy || protectedAccount} onClick={() => setEditing({ ...row })}>Membership</Button><Button size="sm" variant="outline" disabled={busy || protectedAccount} onClick={() => act({ action: "block", id: row.id, blocked: !blocked })}>{blocked ? "Unblock" : "Block"}</Button><Button size="sm" variant="destructive" disabled={busy || protectedAccount} onClick={() => { setDeleting(row); setConfirmation(""); }}>Delete</Button></>}</div></div>
          {tab === "Playgrounds" && <div className="space-y-2 text-sm"><p className="font-medium">{(occupied / 60).toFixed(1)} rental hours / 24 hours ({Math.round(occupied / 1440 * 100)}% rental occupation)</p>{events.map((event,i) => <p key={i} className="rounded bg-muted p-2">{event.time.slice(0,5) || "Time unknown"} · {event.label}</p>)}{events.length === 0 && <p>No bookings recorded for this date.</p>}<p className="text-muted-foreground">Rental gaps: {gaps.join(", ") || "None"}</p></div>}
        </article>;
      })}</div>
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.name ?? selected?.title ?? "Record details"}</DialogTitle><DialogDescription>{tab === "Members" ? "Contact, membership and activity" : "Stored record and related activity"}</DialogDescription></DialogHeader>{selected && (tab === "Members" ? <MemberDetails member={selected} data={data} /> : <Details row={selected} />)}{tab !== "Members" && Object.entries(related).map(([label, records]) => <details key={label}><summary className="cursor-pointer font-medium">{label} ({records?.length ?? 0})</summary><div className="space-y-4 py-3">{records?.map((r: Row) => label === "Members" ? <MemberDetails key={r.id} member={r} data={data} /> : <Details key={r.id} row={r} />)}</div></details>)}</DialogContent></Dialog>
      <Dialog open={!!editing} onOpenChange={open => !busy && !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>Edit membership</DialogTitle><DialogDescription>{editing?.name} · {editing?.email}</DialogDescription></DialogHeader>{editing && <form className="space-y-4" onSubmit={e => { e.preventDefault(); act({ action: "membership", id: editing.id, membership_type: editing.membership_type, subscription_sessions: Number(editing.subscription_sessions), member_plan: editing.member_plan, premium_expires_at: editing.premium_expires_at ? new Date(editing.premium_expires_at).toISOString() : null, is_active: editing.is_active }); }}>
        <label className="block text-sm">Academy membership<select className="mt-1 w-full rounded border bg-background p-2" value={editing.membership_type} onChange={e => setEditing({ ...editing, membership_type: e.target.value })}><option value="full">Full</option><option value="half">Half</option></select></label>
        <label className="block text-sm">Subscription sessions<Input type="number" min="0" max="10000" required value={editing.subscription_sessions} onChange={e => setEditing({ ...editing, subscription_sessions: e.target.value })} /></label>
        <label className="block text-sm">Platform plan<select className="mt-1 w-full rounded border bg-background p-2" value={editing.member_plan} onChange={e => setEditing({ ...editing, member_plan: e.target.value })}><option value="free">Free</option><option value="premium">Premium</option></select></label>
        <label className="block text-sm">Premium expiry (UTC; blank means no expiry)<Input type="date" value={editing.premium_expires_at?.slice(0,10) ?? ""} onChange={e => setEditing({ ...editing, premium_expires_at: e.target.value })} /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />Active academy membership</label>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save membership"}</Button>
      </form>}</DialogContent></Dialog>
      <Dialog open={!!deleting} onOpenChange={open => !busy && !open && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>Permanently delete account?</DialogTitle><DialogDescription>This removes the login and related records according to database deletion rules. This cannot be undone. Type {deleting?.email} to confirm.</DialogDescription></DialogHeader><Input aria-label="Account email confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} /><Button variant="destructive" disabled={busy || confirmation !== deleting?.email} onClick={() => act({ action: "delete", id: deleting!.id, confirmation })}>{busy ? "Deleting…" : "Permanently delete"}</Button></DialogContent></Dialog>
    </CardContent>
  </Card>;
}
