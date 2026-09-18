"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { usePlaygrounds } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/sorted-options";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const fields = [
  ["title", "Title", "العنوان", "text"],
  ["sport", "Sport", "الرياضة", "text"],
  ["game_date", "Date", "التاريخ", "date"],
  ["start_time", "Start time", "وقت البداية", "time"],
  ["duration_hours", "Duration (hours)", "المدة بالساعات", "number"],
  ["min_players", "Minimum players", "الحد الأدنى للاعبين", "number"],
  ["max_players", "Maximum players", "الحد الأقصى للاعبين", "number"],
  ["court_number", "Court number (blank for automatic)", "رقم الملعب (فارغ للاختيار التلقائي)", "number"],
  ["location", "Location", "الموقع", "text"],
  ["area", "City / area", "المدينة / المنطقة", "text"],
  ["lat", "Latitude", "خط العرض", "number"],
  ["lng", "Longitude", "خط الطول", "number"],
  ["min_age", "Minimum age", "الحد الأدنى للعمر", "number"],
  ["max_age", "Maximum age", "الحد الأقصى للعمر", "number"],
  ["playground_hourly_rate", "Hourly rental price", "إيجار الساعة", "number"],
  ["share_price", "Price per player", "السعر لكل لاعب", "number"],
  ["host_total", "Host total", "إجمالي المنظم", "number"],
] as const;
const required = new Set(["title", "sport", "game_date", "start_time", "duration_hours", "min_players", "max_players"]);
const integers = new Set(["min_players", "max_players", "court_number", "min_age", "max_age"]);

type Game = { id: string; title: string } & Record<string, unknown>;
export function AdminGameEditor({ game, onClose }: { game: Game; onClose: () => void }) {
  const { lang, t } = useI18n();
  const ar = lang === "ar";
  const cache = useQueryClient();
  const venues = usePlaygrounds();
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...game, start_time: String(game.start_time ?? "").slice(0, 5) }));
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: unknown) => setDraft(current => ({ ...current, [key]: value }));
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>{ar ? "تعديل المباراة" : "Edit game"}</DialogTitle><DialogDescription>{game.title}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          const changes: Record<string, unknown> = {};
          for (const [key, , , type] of fields) {
            const value = draft[key];
            changes[key] = value === "" || value == null ? null : type === "number" ? Number(value) : value;
          }
          for (const key of ["description", "playground_id", "skill_level", "gender", "recurrence"]) changes[key] = draft[key] || null;
          changes.is_public = !!draft.is_public;
          changes.host_pays = !!draft.host_pays;
          const { error } = await createClient().rpc("admin_update_friendly_game", { p_game_id: game.id, p_changes: changes });
          if (error) throw error;
          await Promise.all(["platform-records", "friendly-games", "my-game-participants"].map(key => cache.invalidateQueries({ queryKey: [key] })));
          toast.success(ar ? "تم حفظ المباراة" : "Game saved");
          onClose();
        } catch (error) {
          toast.error(error && typeof error === "object" && "message" in error ? String(error.message) : t("common_error"));
        } finally { setBusy(false); }
      }}>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          {fields.map(([key, en, arabic, type]) => <label key={key} className="space-y-1 text-sm font-medium">{ar ? arabic : en}
            <Input type={type} required={required.has(key)} step={type === "number" ? integers.has(key) ? "1" : "any" : undefined} value={String(draft[key] ?? "")} onChange={event => set(key, event.target.value)} />
          </label>)}
          <label className="space-y-1 text-sm font-medium">{ar ? "الملعب" : "Playground"}
            <NativeSelect className="w-full rounded-md border bg-background p-2" value={String(draft.playground_id ?? "")} onChange={event => setDraft(current => ({ ...current, playground_id: event.target.value || null, court_number: null }))}>
              <option value="">{ar ? "بدون ملعب" : "No playground"}</option>
              {draft.playground_id && !venues.data?.some(v => v.id === draft.playground_id) ? <option value={String(draft.playground_id)}>{ar ? "الملعب الحالي" : "Current playground"}</option> : null}
              {venues.data?.map(venue => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
            </NativeSelect>
          </label>
          {([
            ["skill_level", ar ? "المستوى" : "Skill level", [["", ar ? "أي مستوى" : "Any level"], ["beginner", ar ? "مبتدئ" : "Beginner"], ["intermediate", ar ? "متوسط" : "Intermediate"], ["advanced", ar ? "متقدم" : "Advanced"]]],
            ["gender", ar ? "النوع" : "Gender", [["mixed", ar ? "مختلط" : "Mixed"], ["male", ar ? "رجال" : "Men"], ["female", ar ? "سيدات" : "Women"]]],
            ["recurrence", ar ? "التكرار" : "Recurrence", [["", ar ? "مرة واحدة" : "One time"], ["weekly", ar ? "أسبوعي" : "Weekly"]]],
          ] as const).map(([key, label, options]) => <label key={key} className="space-y-1 text-sm font-medium">{label}<NativeSelect className="w-full rounded-md border bg-background p-2" value={String(draft[key] ?? "")} onChange={event => set(key, event.target.value)}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</NativeSelect></label>)}
          <label className="space-y-1 text-sm font-medium sm:col-span-2">{ar ? "الوصف" : "Description"}<textarea className="min-h-24 w-full rounded-md border bg-background p-2" value={String(draft.description ?? "")} onChange={event => set("description", event.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.is_public} onChange={event => set("is_public", event.target.checked)} />{ar ? "مباراة عامة" : "Public game"}</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.host_pays} onChange={event => setDraft(current => ({ ...current, host_pays: event.target.checked, ...(event.target.checked ? { share_price: 0 } : {}) }))} />{ar ? "المنظم يدفع" : "Host pays"}</label>
        </fieldset>
        <p className="text-sm text-muted-foreground">{ar ? "الأسعار صريحة ولا يعاد حسابها تلقائياً عند تغيير الملعب أو المدة. تظل إيصالات ومدفوعات المشاركين السابقة محفوظة. يتم إخطار المشاركين بالتغييرات." : "Prices are explicit: review them when changing the playground or duration. Existing payments and receipts stay recorded. Participants are notified of changes."}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("common_cancel")}</Button><Button type="submit" disabled={busy}>{busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التغييرات" : "Save changes")}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
