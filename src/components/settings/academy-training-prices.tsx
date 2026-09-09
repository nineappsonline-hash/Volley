"use client";

import { useEffect, useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { formatMoney } from "@/lib/constants";

type Offering = { id?: string; monthly_sessions?: number | null; monthly_price?: number | null; tryout_price?: number | null };

export function AcademyTrainingSummary({ academy }: { academy: Offering }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  if (academy.monthly_sessions == null && academy.tryout_price == null) return null;
  return <section className="rounded-xl border bg-card p-4 space-y-2">
    <h2 className="font-semibold">{ar ? "الاشتراك الشهري والحصة التجريبية" : "Monthly training & tryout"}</h2>
    {academy.monthly_sessions != null && academy.monthly_price != null && <p className="text-sm">{ar ? `${academy.monthly_sessions} حصص في الشهر — ${formatMoney(academy.monthly_price)} شهريًا` : `${academy.monthly_sessions} sessions per month — ${formatMoney(academy.monthly_price)} / month`}</p>}
    {academy.tryout_price != null && <p className="text-sm">{ar ? `حصة تجريبية واحدة — ${formatMoney(academy.tryout_price)}` : `Single tryout session — ${formatMoney(academy.tryout_price)}`}</p>}
  </section>;
}

export function AcademyTrainingPrices({ academy }: { academy: Offering & { id: string } }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const id = useId();
  const qc = useQueryClient();
  const [sessions, setSessions] = useState("");
  const [monthly, setMonthly] = useState("");
  const [tryout, setTryout] = useState("");
  useEffect(() => {
    setSessions(academy.monthly_sessions == null ? "" : String(academy.monthly_sessions));
    setMonthly(academy.monthly_price == null ? "" : String(academy.monthly_price));
    setTryout(academy.tryout_price == null ? "" : String(academy.tryout_price));
  }, [academy.id, academy.monthly_sessions, academy.monthly_price, academy.tryout_price]);
  const save = useMutation({
    mutationFn: async () => {
      const count = sessions.trim() === "" ? null : Number(sessions);
      const price = monthly.trim() === "" ? null : Number(monthly);
      const trial = tryout.trim() === "" ? null : Number(tryout);
      if ((count == null) !== (price == null) || (count != null && (!Number.isInteger(count) || count < 1 || count > 100))
        || [price, trial].some(n => n != null && (!Number.isFinite(n) || n < 0 || n >= 100000000)))
        throw new Error(ar ? "اكتب عدد حصص صحيح وسعر شهري معاه. الأسعار لازم تكون صفر أو أكتر." : "Enter a valid session count with a monthly price. Prices must be zero or greater.");
      const { error } = await createClient().rpc("set_academy_training_prices", {
        p_academy_id: academy.id, p_monthly_sessions: count, p_monthly_price: price, p_tryout_price: trial,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(ar ? "تم حفظ أسعار التدريب" : "Training prices saved");
      for (const key of ["academy", "all-academies", "platform-records", "academy-management", "public-academies"])
        void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: error => toast.error(errorMessage(error, ar ? "تعذر الحفظ" : "Could not save")),
  });
  return <section className="rounded-xl border bg-card p-4 space-y-4">
    <h2 className="font-semibold">{ar ? "أسعار تدريب الأعضاء" : "Member training prices"}</h2>
    <p className="text-xs text-muted-foreground">{ar ? "الأسعار دي بتظهر في صفحة الأكاديمية. سيب السعر فاضي لو لسه مش محدد، أو اكتب صفر لو مجاني." : "Shown on your academy page. Leave a price blank if unset, or enter zero for free."}</p>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1"><Label htmlFor={`${id}-sessions`}>{ar ? "عدد الحصص شهريًا" : "Sessions per month"}</Label><Input id={`${id}-sessions`} type="number" min="1" max="100" step="1" value={sessions} disabled={save.isPending} onChange={e => setSessions(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor={`${id}-monthly`}>{ar ? "السعر الشهري (جنيه)" : "Monthly price (EGP)"}</Label><Input id={`${id}-monthly`} type="number" min="0" step="0.01" value={monthly} disabled={save.isPending} onChange={e => setMonthly(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor={`${id}-tryout`}>{ar ? "حصة تجريبية واحدة (جنيه)" : "Single tryout (EGP)"}</Label><Input id={`${id}-tryout`} type="number" min="0" step="0.01" value={tryout} disabled={save.isPending} onChange={e => setTryout(e.target.value)} /></div>
    </div>
    <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? (ar ? "جاري الحفظ…" : "Saving…") : (ar ? "حفظ أسعار التدريب" : "Save training prices")}</Button>
  </section>;
}
