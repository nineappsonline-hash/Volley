"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import { sessionPackageAmount, sessionPackageOptions, groupScheduledSessions, type SessionPackage } from "@/lib/admin/training-assignment";

type Row = Record<string, any>;

/**
 * Always rendered, never behind an "Assign" toggle, so a super admin can always
 * see the session packages and the amount due while working on a member.
 *
 * A package must be chosen explicitly and the amount is sent to
 * admin_assign_training, which recomputes it server-side and rejects a stale
 * total rather than charging the wrong figure.
 */
export function MemberTrainingAssignment({ member, academies, programs }: { member: Row; academies: Row[]; programs: Row[] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const cache = useQueryClient();
  const [academy, setAcademy] = useState(member.academy_id ?? "");
  const [program, setProgram] = useState("");
  const [sessions, setSessions] = useState<SessionPackage | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);

  const group = programs.find((p) => p.id === program && p.academy_id === academy && p.active);
  const groups = programs.filter((p) => p.academy_id === academy && p.active);
  const options = sessionPackageOptions(group);
  const chosen = options.find((option) => option.count === sessions);
  const amountDue = group && chosen ? sessionPackageAmount(group, chosen.count) : 0;
  const scheduled = groupScheduledSessions(group);

  return <form className="space-y-4 rounded-xl border bg-muted/20 p-4" onSubmit={async (e) => {
    e.preventDefault();
    if (busy || !group || !sessions) return;
    setBusy(true);
    try {
      const { error } = await createClient().rpc("admin_assign_training", {
        p_member_id: member.id,
        p_program_id: group.id,
        p_sessions: sessions,
        p_paid: paid,
        p_expected_amount: amountDue,
      });
      if (error) throw error;
      await cache.invalidateQueries();
      setProgram("");
      setSessions(null);
      setPaid(false);
      toast.success(ar ? "تم تسجيل العضو" : "Member assigned");
    } catch (error) {
      toast.error(errorMessage(error, ar ? "تعذر التسجيل" : "Could not assign member"));
    } finally {
      setBusy(false);
    }
  }}>
    <h3 className="font-semibold">{ar ? "تسجيل في مجموعة تدريب" : "Training group enrollment"}</h3>

    <label className="block space-y-1 text-sm">{ar ? "الأكاديمية" : "Academy"}<select required disabled={busy} className="block min-h-11 w-full rounded border bg-background p-2" value={academy} onChange={(e) => { setAcademy(e.target.value); setProgram(""); setSessions(null); }}><option value="">{ar ? "اختار الأكاديمية" : "Choose academy"}</option>{academies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>

    <label className="block space-y-1 text-sm">{ar ? "المجموعة" : "Training group"}<select required disabled={busy || !academy} className="block min-h-11 w-full rounded border bg-background p-2" value={program} onChange={(e) => { setProgram(e.target.value); setSessions(null); }}><option value="">{ar ? "اختار المجموعة" : "Choose group"}</option>{groups.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {academy && !groups.length && <p className="text-sm text-muted-foreground">{ar ? "أضف مجموعة تدريب نشطة لهذه الأكاديمية أولاً." : "Add an active training group to this academy first."}</p>}

    <fieldset disabled={busy || !group}>
      <legend className="mb-2 text-sm font-medium">{ar ? "عدد الحصص والمبلغ المستحق" : "Sessions & amount due"}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map(({ count, amount, available, seats }) => <label key={count} className={`flex items-start gap-2 rounded-lg border p-3 ${sessions === count ? "border-primary bg-primary/5" : ""} ${available ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
          <input type="radio" name="assignment-sessions" className="mt-1" checked={sessions === count} disabled={!available} onChange={() => setSessions(count)} />
          <span className="min-w-0 text-sm">
            {count === 1 ? (ar ? "حصة واحدة" : "Single session") : `${count} ${ar ? "حصص" : "sessions"}`}
            <strong className="mt-1 block">{group ? formatMoney(amount, lang) : "—"}</strong>
            {group && !available && <span className="mt-1 block text-xs text-muted-foreground">{ar ? `لا يوجد إلا ${seats} مقعد متاح` : `Only ${seats} seat${seats === 1 ? "" : "s"} open`}</span>}
          </span>
        </label>)}
      </div>
      {group && !options.some((option) => option.available) && <p className="mt-2 text-sm text-destructive">{scheduled === 0
        ? ar ? "مفيش مواعيد قادمة في جدول هذه المجموعة خلال الثلاثين يومًا الجاية." : "This group has no upcoming sessions scheduled in the next 30 days."
        : ar ? "كل مواعيد هذه المجموعة محجوزة بالفعل." : "Every session in this group is already full."}</p>}
    </fieldset>

    <label className="flex min-h-11 items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={paid} disabled={busy} onChange={(e) => setPaid(e.target.checked)} />{ar ? "تم استلام المبلغ بالفعل" : "Payment already received"}</label>

    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{ar ? "المبلغ المستحق" : "Amount due"}:</span>
      <span className="font-semibold">{group && chosen ? formatMoney(amountDue, lang) : "—"}</span>
      <Badge variant={paid ? "success" : "secondary"} className="gap-1">{paid ? (ar ? "مدفوع" : "Paid") : (ar ? "لم يدفع بعد" : "Not yet paid")}</Badge>
      {group && !paid && <span className="text-xs text-muted-foreground">{ar ? "يمكن تأكيد الدفع بعدين من تبويب المدفوعات." : "You can confirm payment later from the Payments tab."}</span>}
    </div>

    <p className="text-xs text-muted-foreground">{ar ? "تُحجز أول حصص متاحة خلال 30 يومًا. الحجز غير المدفوع يُحفظ لمدة 24 ساعة أو حتى بداية أول حصة، أيهما أقرب." : "Reserves the next available sessions within 30 days. Unpaid bookings are held for 24 hours or until the first session, whichever comes first."}</p>

    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || !group || !sessions} type="submit">{busy ? (ar ? "بنحفظ…" : "Saving…") : (ar ? "تأكيد التسجيل" : "Confirm enrollment")}</Button>
      {!sessions && group && <span className="self-center text-xs text-muted-foreground">{ar ? "اختار عدد الحصص أولًا" : "Choose how many sessions first"}</span>}
    </div>
  </form>;
}

export function ConfirmTrainingPayment({ booking }: { booking: Row }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const cache = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (booking.details?.admin_assigned !== true || booking.status !== "awaiting_payment") return null;
  if (new Date(booking.hold_until) <= new Date()) return <p className="text-xs text-muted-foreground">{ar ? "انتهت مهلة الدفع" : "Payment hold expired"}</p>;
  return <div className="space-y-2">{confirm && <p className="text-sm">{ar ? "تأكيد استلام" : "Confirm receipt of"} {formatMoney(Number(booking.amount), lang)}?</p>}<Button size="sm" disabled={busy} onClick={async () => {
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try {
      const { error } = await createClient().rpc("admin_confirm_training_payment", { p_booking_id: booking.id });
      if (error) throw error;
      await cache.invalidateQueries();
      setConfirm(false);
      toast.success(ar ? "تم تأكيد الدفع" : "Payment confirmed");
    } catch (error) {
      toast.error(errorMessage(error, ar ? "تعذر التأكيد" : "Could not confirm payment"));
    } finally { setBusy(false); }
  }}>{confirm ? (ar ? "تأكيد استلام المبلغ" : "Confirm payment received") : (ar ? "تسجيل الدفع" : "Mark as paid")}</Button>{confirm && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>{ar ? "إلغاء" : "Cancel"}</Button>}</div>;
}

export function MemberAttendanceEdit({ memberId, record }: { memberId: string; record: Row }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  return <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/platform-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "member_attendance", id: memberId, attendance_id: record.id, is_present: !record.is_present }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await cache.invalidateQueries();
      toast.success(ar ? "تم تحديث الحضور" : "Attendance updated");
    } catch (error) { toast.error(errorMessage(error, ar ? "تعذر الحفظ" : "Could not save")); }
    finally { setBusy(false); }
  }}>{record.is_present ? (ar ? "تسجيل غائب" : "Mark absent") : (ar ? "تسجيل حاضر" : "Mark attended")}</Button>;
}