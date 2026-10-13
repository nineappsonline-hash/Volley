"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, CalendarClock, ListOrdered, MapPin, Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usePlaygrounds } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NativeSelect } from "@/components/ui/sorted-options";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const fields = [
  ["title", "Title", "العنوان", "text"],
  ["sport", "Sport", "الرياضة", "text"],
  ["game_date", "Date", "التاريخ", "date"],
  ["start_time", "Start time", "وقت البداية", "time"],
  ["duration_hours", "Duration (hours)", "المدة بالساعات", "number"],
  ["min_players", "Minimum players", "الحد الأدنى للاعبين", "number"],
  ["max_players", "Maximum players", "الحد الأقصى للاعبين", "number"],
  ["court_number", "Court number", "رقم الملعب", "number"],
  ["location", "Location", "الموقع", "text"],
  ["area", "City / area", "المدينة / المنطقة", "text"],
  ["lat", "Latitude", "خط العرض", "number"],
  ["lng", "Longitude", "خط الطول", "number"],
  ["min_age", "Minimum age", "الحد الأدنى للعمر", "number"],
  ["max_age", "Maximum age", "الحد الأقصى للعمر", "number"],
  ["playground_hourly_rate", "Hourly rental price", "إيجار الساعة", "number"],
  ["share_price", "Price per player", "السعر لكل لاعب", "number"],
] as const;
const required = new Set(["title", "sport", "game_date", "start_time", "duration_hours", "min_players", "max_players"]);
const integers = new Set(["min_players", "max_players", "court_number", "min_age", "max_age"]);

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

type Game = { id: string; title: string } & Record<string, unknown>;
export function AdminGameEditor({ game, onClose }: { game: Game; onClose: () => void }) {
  const { lang, t } = useI18n();
  const ar = lang === "ar";
  const cache = useQueryClient();
  const venues = usePlaygrounds();
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...game, start_time: String(game.start_time ?? "").slice(0, 5) }));
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: unknown) => setDraft(current => ({ ...current, [key]: value }));

  const input = (key: string, type: string, opts: { required?: boolean; step?: string; className?: string; min?: number; disabled?: boolean } = {}) => (
    <Input
      type={type}
      min={opts.min}
      disabled={opts.disabled}
      aria-label={key === "share_price" ? (ar ? "تجاوز السعر لكل لاعب لهذه المباراة" : "Override price per player for this game") : undefined}
      required={opts.required ?? required.has(key)}
      step={opts.step ?? (type === "number" ? (integers.has(key) ? "1" : "any") : undefined)}
      className={opts.className}
      value={String(draft[key] ?? "")}
      onChange={event => set(key, event.target.value)}
    />
  );

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ar ? "تعديل المباراة" : "Edit game"}</DialogTitle>
          <DialogDescription className="truncate">{game.title}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async event => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const changes: Record<string, unknown> = {};
              for (const [key, , , type] of fields) {
                const value = draft[key];
                changes[key] = value === "" || value == null ? null : type === "number" ? Number(value) : value;
              }
              changes.status = String(draft.status ?? "open");
              for (const key of ["description", "playground_id", "skill_level", "gender", "recurrence"]) changes[key] = draft[key] || null;
              changes.is_public = !!draft.is_public;
              changes.host_pays = !!draft.host_pays;
              if (changes.host_pays) changes.share_price = 0;
              if (changes.share_price != null && (!Number.isFinite(changes.share_price as number) || Number(changes.share_price) < 0)) {
                throw new Error(ar ? "أدخل سعراً صحيحاً لا يقل عن صفر." : "Enter a valid price of zero or more.");
              }
              const { error } = await createClient().rpc("admin_update_friendly_game", { p_game_id: game.id, p_changes: changes });
              if (error) throw error;
              await Promise.all(["platform-records", "friendly-games", "my-game-participants"].map(key => cache.invalidateQueries({ queryKey: [key] })));
              toast.success(ar ? "تم حفظ المباراة" : "Game saved");
              onClose();
            } catch (error) {
              toast.error(error && typeof error === "object" && "message" in error ? String(error.message) : t("common_error"));
            } finally { setBusy(false); }
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <Section icon={ListOrdered} title={ar ? "الحالة" : "Status"}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={ar ? "حالة المباراة" : "Game status"} required>
                  <Select value={String(draft.status ?? "open")} onValueChange={value => set("status", value)}>
                    <SelectTrigger aria-label={ar ? "حالة المباراة" : "Game status"} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{ar ? "مفتوحة" : "Open"}</SelectItem>
                      <SelectItem value="full">{ar ? "ممتلئة" : "Full"}</SelectItem>
                      <SelectItem value="completed">{ar ? "مكتملة" : "Completed"}</SelectItem>
                      <SelectItem value="cancelled">{ar ? "ملغاة" : "Cancelled"}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="col-span-2 flex flex-wrap items-end gap-6 py-1">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={!!draft.is_public} onCheckedChange={checked => set("is_public", !!checked)} />
                    {ar ? "مباراة عامة" : "Public game"}
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={!!draft.host_pays}
                      onCheckedChange={checked =>
                        setDraft(current => ({ ...current, host_pays: !!checked, ...(checked ? { share_price: 0 } : {}) }))
                      }
                    />
                    {ar ? "المنظم يدفع" : "Host pays"}
                  </label>
                </div>
              </div>
            </Section>

            <Section icon={CalendarClock} title={ar ? "الموعد والملعب" : "Schedule & court"}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={ar ? "التاريخ" : "Date"} required>{input("game_date", "date")}</Field>
                <Field label={ar ? "وقت البداية" : "Start time"} required>{input("start_time", "time")}</Field>
                <Field label={ar ? "المدة (ساعات)" : "Duration (hours)"} required>{input("duration_hours", "number")}</Field>
                <Field label={ar ? "رقم الملعب" : "Court number"}>{input("court_number", "number")}</Field>
                <Field label={ar ? "التكرار" : "Repeats"} className="col-span-2">
                  <NativeSelect className="w-full rounded-md border bg-card p-2" value={String(draft.recurrence ?? "")} onChange={event => set("recurrence", event.target.value)}>
                    <option value="">{ar ? "مرة واحدة" : "One time"}</option>
                    <option value="weekly">{ar ? "أسبوعي" : "Weekly"}</option>
                  </NativeSelect>
                </Field>
                <Field label={ar ? "الملعب" : "Playground"} className="sm:col-span-3">
                  <NativeSelect className="w-full rounded-md border bg-card p-2" value={String(draft.playground_id ?? "")} onChange={event => setDraft(current => ({ ...current, playground_id: event.target.value || null, court_number: null }))}>
                    <option value="">{ar ? "بدون ملعب" : "No playground"}</option>
                    {draft.playground_id && !venues.data?.some(v => v.id === draft.playground_id) ? <option value={String(draft.playground_id)}>{ar ? "الملعب الحالي" : "Current playground"}</option> : null}
                    {venues.data?.map(venue => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                  </NativeSelect>
                </Field>
              </div>
            </Section>

            <Section icon={Users2} title={ar ? "اللاعبون" : "Players & criteria"}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={ar ? "الحد الأدنى" : "Minimum players"} required>{input("min_players", "number")}</Field>
                <Field label={ar ? "الحد الأقصى" : "Maximum players"} required>{input("max_players", "number")}</Field>
                <Field label={ar ? "المستوى" : "Skill level"}>
                  <NativeSelect className="w-full rounded-md border bg-card p-2" value={String(draft.skill_level ?? "")} onChange={event => set("skill_level", event.target.value)}>
                    <option value="">{ar ? "أي مستوى" : "Any level"}</option>
                    <option value="beginner">{ar ? "مبتدئ" : "Beginner"}</option>
                    <option value="intermediate">{ar ? "متوسط" : "Intermediate"}</option>
                    <option value="advanced">{ar ? "متقدم" : "Advanced"}</option>
                  </NativeSelect>
                </Field>
                <Field label={ar ? "النوع" : "Gender"}>
                  <NativeSelect className="w-full rounded-md border bg-card p-2" value={String(draft.gender ?? "mixed")} onChange={event => set("gender", event.target.value)}>
                    <option value="mixed">{ar ? "مختلط" : "Mixed"}</option>
                    <option value="male">{ar ? "رجال" : "Men"}</option>
                    <option value="female">{ar ? "سيدات" : "Women"}</option>
                  </NativeSelect>
                </Field>
                <Field label={ar ? "الحد الأدنى للعمر" : "Minimum age"}>{input("min_age", "number")}</Field>
                <Field label={ar ? "الحد الأقصى للعمر" : "Maximum age"}>{input("max_age", "number")}</Field>
              </div>
            </Section>

            <Section icon={MapPin} title={ar ? "الموقع" : "Location"}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={ar ? "الموقع" : "Location"}>{input("location", "text")}</Field>
                <Field label={ar ? "المدينة / المنطقة" : "City / area"}>{input("area", "text")}</Field>
                <Field label={ar ? "خط العرض" : "Latitude"}>{input("lat", "number")}</Field>
                <Field label={ar ? "خط الطول" : "Longitude"}>{input("lng", "number")}</Field>
              </div>
            </Section>

            <Section icon={Banknote} title={ar ? "الأسعار" : "Pricing"}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={ar ? "إيجار الساعة" : "Hourly rental"}>
                  {input("playground_hourly_rate", "number")}
                </Field>
              </div>
              <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <Field label={ar ? "السعر لكل لاعب (ج.م) — لهذه المباراة فقط" : "Price per player (EGP) — this game only"}>
                  {input("share_price", "number", { min: 0, step: "0.01", disabled: !!draft.host_pays })}
                </Field>
                <p className="text-xs leading-relaxed text-muted-foreground">{draft.host_pays
                  ? (ar ? "المنظم يغطي التكلفة، لذلك سعر اللاعب صفر. أوقف خيار دفع المنظم لتحديد سعر للاعب." : "The host covers the cost, so the player price is zero. Turn off host-paid mode to set a player price.")
                  : (ar ? "يطبق هذا السعر على هذه المباراة فقط. لا تتغير أسعار الملعب أو المباريات الأخرى. أدخل صفر لجعل المشاركة مجانية." : "This price applies only to this game. Playground rates and other games stay the same. Enter zero for free participation.")}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "الأسعار صريحة ولا تُعاد حسبتها تلقائياً. تبقى المدفوعات والإيصالات السابقة محفوظة، ويتم إخطار المشاركين بالتغييرات."
                  : "Prices are explicit and are not recomputed automatically. Existing payments stay recorded, and participants are notified of changes."}
              </p>
            </Section>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {t("common_cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التغييرات" : "Save changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}