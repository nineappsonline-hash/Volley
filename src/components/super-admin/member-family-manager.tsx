"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/shared/query-state";

type Child = { id?: string; name: string; gender: string; birth_date: string; phone: string; academy_id: string };
const blank: Child = { name: "", gender: "male", birth_date: "", phone: "", academy_id: "" };

const toDraft = (child: { id?: string; name?: string | null; gender?: string | null; birth_date?: string | null; phone?: string | null; academy_id?: string | null }): Child => ({
  id: child.id,
  name: child.name ?? "",
  gender: child.gender ?? "male",
  birth_date: child.birth_date ?? "",
  phone: child.phone ?? "",
  academy_id: child.academy_id ?? "",
});

/**
 * A child row is always an editable form rather than a summary plus an "Edit"
 * button, so name, birth date, gender, phone and academy can be changed without
 * switching this tab into another mode.
 */
function ChildRow({ child, academies, busy, onSave }: {
  child: { id: string; name: string; gender: string | null; birth_date: string | null; phone: string | null; academy_id: string | null };
  academies: { id: string; name: string }[];
  busy: boolean;
  onSave: (draft: Child) => Promise<boolean>;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [draft, setDraft] = useState<Child>(() => toDraft(child));
  const set = (key: keyof Child, value: string) => setDraft({ ...draft, [key]: value });

  return <form className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2" onSubmit={async (e) => {
    e.preventDefault();
    if (busy) return;
    // The draft already holds the values that were just persisted, so it is
    // left alone on success; only Discard needs to pull the row back.
    await onSave({ ...draft, id: child.id });
  }}>
    <label className="space-y-1 text-sm sm:col-span-2">{ar ? "الاسم الكامل" : "Full name"}<Input required maxLength={100} value={draft.name} disabled={busy} onChange={(e) => set("name", e.target.value)} /></label>
    <label className="space-y-1 text-sm">{ar ? "تاريخ الميلاد" : "Date of birth"}<Input required type="date" max={new Date().toISOString().slice(0, 10)} value={draft.birth_date} disabled={busy} onChange={(e) => set("birth_date", e.target.value)} /></label>
    <label className="space-y-1 text-sm">{ar ? "النوع" : "Gender"}<select className="block min-h-10 w-full rounded border bg-background p-2" value={draft.gender} disabled={busy} onChange={(e) => set("gender", e.target.value)}><option value="male">{ar ? "ذكر" : "Male"}</option><option value="female">{ar ? "أنثى" : "Female"}</option></select></label>
    <label className="space-y-1 text-sm">{ar ? "الهاتف (اختياري)" : "Phone (optional)"}<Input type="tel" maxLength={40} value={draft.phone} disabled={busy} onChange={(e) => set("phone", e.target.value)} /></label>
    <label className="space-y-1 text-sm">{ar ? "الأكاديمية" : "Academy"}<select className="block min-h-10 w-full rounded border bg-background p-2" value={draft.academy_id} disabled={busy} onChange={(e) => set("academy_id", e.target.value)}><option value="">{ar ? "بدون أكاديمية" : "No academy"}</option>{academies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <div className="flex flex-wrap gap-2 sm:col-span-2">
      <Button type="submit" disabled={busy}>{busy ? (ar ? "بنحفظ…" : "Saving…") : (ar ? "حفظ" : "Save")}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(toDraft(child))}>{ar ? "تراجع" : "Discard"}</Button>
    </div>
  </form>;
}

export function MemberFamilyManager({ memberId, academies }: { memberId: string; academies: { id: string; name: string }[] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const cache = useQueryClient();
  const [newChild, setNewChild] = useState<Child>({ ...blank });
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["admin-family", memberId], queryFn: async () => {
    const db = createClient();
    const [parent, children] = await Promise.all([
      db.from("profiles").select("is_parent,guardian_id,role,email").eq("id", memberId).single(),
      db.from("profiles").select("id,name,gender,birth_date,phone,academy_id").eq("guardian_id", memberId).order("name"),
    ]);
    if (parent.error) throw parent.error;
    if (children.error) throw children.error;
    return { parent: parent.data, children: children.data };
  }});
  const refresh = async () => { await Promise.all([cache.invalidateQueries({ queryKey: ["admin-family", memberId] }), cache.invalidateQueries({ queryKey: ["platform-records"] }), cache.invalidateQueries({ queryKey: ["children"] })]); };
  const saveChild = async (draft: Child) => {
    setBusy(true);
    try {
      const { error } = await createClient().rpc("admin_save_family_child", { p_parent_id: memberId, p_child_id: draft.id ?? null, p_details: draft });
      if (error) throw error;
      await refresh();
      toast.success(ar ? "تم الحفظ" : "Saved");
      return true;
    } catch (error) { toast.error(errorMessage(error, ar ? "تعذر الحفظ" : "Could not save")); return false; }
    finally { setBusy(false); }
  };
  const act = async (work: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    try { const { error } = await work(); if (error) throw error; await refresh(); toast.success(ar ? "تم الحفظ" : "Saved"); return true; }
    catch (error) { toast.error(errorMessage(error, ar ? "تعذر الحفظ" : "Could not save")); return false; }
    finally { setBusy(false); }
  };
  const parent = query.data?.parent;
  const children = query.data?.children ?? [];
  const isParent = parent?.is_parent || children.length > 0;
  return <section className="space-y-4 rounded-xl border p-4"><h3 className="font-semibold">{ar ? "حساب ولي الأمر والأبناء" : "Parent account & children"}</h3>
    <QueryState queries={[query]}>{parent?.guardian_id ? <p className="text-sm">{ar ? "الحساب ده تابع لولي أمر. افتح حساب ولي الأمر لإدارة بيانات الأبناء." : "This is a child profile. Open the parent’s member details to manage the family."}</p> : parent?.role !== "member" || !parent?.email ? <p className="text-sm">{ar ? "إدارة الأسرة متاحة لحساب عضو لديه تسجيل دخول." : "Family management requires a member with a login account."}</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium">{isParent ? (ar ? "نوع الحساب: ولي أمر" : "Account type: Parent") : (ar ? "نوع الحساب: عضو" : "Account type: Member")}</p>
        <Button type="button" variant="outline" disabled={busy || (!!isParent && children.length > 0)} onClick={() => act(() => createClient().rpc("admin_set_parent_account", { p_parent_id: memberId, p_enabled: !isParent }))}>{isParent ? (ar ? "تحويل إلى عضو" : "Change to member") : (ar ? "تحويل إلى ولي أمر" : "Change to parent")}</Button></div>
      <p className="text-xs text-muted-foreground">{ar ? "يحتفظ ولي الأمر بتسجيل دخوله. ملفات الأبناء تُدار من لوحة الأسرة بدون تسجيل دخول مستقل." : "The parent keeps their login. Children are managed through the family dashboard without separate logins."}</p>

      {children.map((child) => <ChildRow
        key={child.id}
        child={child}
        academies={academies}
        busy={busy}
        onSave={saveChild}
      />)}

      <form className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        if (await saveChild({ ...newChild })) setNewChild({ ...blank });
      }}>
        <h4 className="font-medium sm:col-span-2">{ar ? "إضافة ابن أو ابنة" : "Add child"}</h4>
        <label className="space-y-1 text-sm sm:col-span-2">{ar ? "الاسم الكامل" : "Full name"}<Input required maxLength={100} value={newChild.name} disabled={busy} onChange={(e) => setNewChild({ ...newChild, name: e.target.value })} /></label>
        <label className="space-y-1 text-sm">{ar ? "تاريخ الميلاد" : "Date of birth"}<Input required type="date" max={new Date().toISOString().slice(0, 10)} value={newChild.birth_date} disabled={busy} onChange={(e) => setNewChild({ ...newChild, birth_date: e.target.value })} /></label>
        <label className="space-y-1 text-sm">{ar ? "النوع" : "Gender"}<select className="block min-h-10 w-full rounded border bg-background p-2" value={newChild.gender} disabled={busy} onChange={(e) => setNewChild({ ...newChild, gender: e.target.value })}><option value="male">{ar ? "ذكر" : "Male"}</option><option value="female">{ar ? "أنثى" : "Female"}</option></select></label>
        <label className="space-y-1 text-sm">{ar ? "الهاتف (اختياري)" : "Phone (optional)"}<Input type="tel" maxLength={40} value={newChild.phone} disabled={busy} onChange={(e) => setNewChild({ ...newChild, phone: e.target.value })} /></label>
        <label className="space-y-1 text-sm">{ar ? "الأكاديمية" : "Academy"}<select className="block min-h-10 w-full rounded border bg-background p-2" value={newChild.academy_id} disabled={busy} onChange={(e) => setNewChild({ ...newChild, academy_id: e.target.value })}><option value="">{ar ? "بدون أكاديمية" : "No academy"}</option>{academies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? (ar ? "بنحفظ…" : "Saving…") : (ar ? "إضافة الابن" : "Add child")}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setNewChild({ ...blank })}>{ar ? "مسح" : "Clear"}</Button></div>
      </form>
    </>}</QueryState></section>;
}