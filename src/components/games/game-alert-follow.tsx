"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { authLink } from "@/lib/auth-redirect";
import { usePushNotifications } from "@/lib/push";
import { COMMUNITY_SPORTS } from "@/lib/constants";
import type { GameAlertPreferences } from "@/lib/game-alert-preferences";

type Preferences = Partial<GameAlertPreferences> & { authenticated: boolean };
async function preferencesRequest(body?: { sport: string; following: boolean }): Promise<Preferences> {
  const response = await fetch("/api/game-alerts", body ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  if (!response.ok) throw new Error("Game alert preferences are unavailable");
  return response.json();
}

export function GameAlertFollow({ sport, returnTo, language }: { sport: string; returnTo: string; language?: "en" | "ar" }) {
  const { lang: preferredLanguage } = useI18n();
  const lang = language ?? preferredLanguage;
  const ar = lang === "ar";
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null | undefined>();
  const [message, setMessage] = useState("");
  const push = usePushNotifications();
  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setMessage("");
    });
    return () => subscription.unsubscribe();
  }, []);
  const queryKey = ["game-alert-preferences", userId];
  const preferences = useQuery({ queryKey, queryFn: () => preferencesRequest(), enabled: userId !== undefined && userId !== null, staleTime: 0, refetchOnWindowFocus: true });
  const following = !!preferences.data?.notify_game_alerts && !!preferences.data.interested_sports?.some(s => s.trim().toLowerCase() === sport.toLowerCase());
  const save = useMutation({
    mutationFn: (next: boolean) => preferencesRequest({ sport, following: next }),
    onSuccess: (data) => {
      qc.setQueryData(queryKey, data);
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["community-members"] });
      setMessage(ar ? "تم حفظ اختياراتك" : "Your preferences are saved");
    },
    onError: () => setMessage(ar ? "تعذر الحفظ. حاول تاني أو راجع تسجيل الدخول." : "Could not save. Try again or check that you are signed in."),
  });
  const signedOut = userId === null || preferences.data?.authenticated === false;
  return <section aria-label={ar ? "العب تاني" : "Play again"} className="space-y-3 rounded-xl border bg-card p-5">
    <h2 className="text-xl font-bold">{ar ? `خليك متابع ماتشات ${sport}` : `Play ${sport} again`}</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">{ar ? "تابع الرياضة عشان توصلك تنبيهات الماتشات الجديدة في حسابك. تنبيهات الماتشات الجديدة بتستخدم رياضاتك المفضلة؛ مش مقصورة على منطقة معينة." : "Follow this sport for new-game alerts in your account. New-game alerts use your profile’s sport interests; they are not limited to this area."}</p>
    {signedOut ? <Button asChild variant="outline"><Link href={authLink("/login", returnTo)}>{ar ? "سجّل الدخول لمتابعة الرياضة" : "Sign in to follow this sport"}</Link></Button> : userId === undefined || preferences.isPending ? <p role="status" className="text-sm">{ar ? "جاري تحميل اختياراتك…" : "Loading your preferences…"}</p> : preferences.isError ? <div><p role="alert" className="text-sm">{ar ? "تعذر تحميل التنبيهات" : "Could not load alerts"}</p><Button variant="outline" onClick={() => void preferences.refetch()}>{ar ? "حاول تاني" : "Retry"}</Button></div> : <>
      {!preferences.data?.notify_game_alerts && <p className="text-sm">{ar ? "المتابعة هتفعّل تنبيهات الماتشات لكل الرياضات الموجودة في اهتماماتك." : "Following enables game alerts for all sports in your interests."}</p>}
      <Button variant="outline" disabled={save.isPending} aria-pressed={following} onClick={() => save.mutate(!following)}>{following ? <BellOff className="me-2 h-4 w-4" /> : <Bell className="me-2 h-4 w-4" />}{save.isPending ? ar ? "جاري الحفظ…" : "Saving…" : following ? ar ? "إلغاء متابعة الرياضة" : "Unfollow this sport" : ar ? "تابع الرياضة وفعّل التنبيهات" : "Follow sport & enable alerts"}</Button>
      <p className="text-xs text-muted-foreground">{ar ? "المتابعة بتضيف الرياضة لاهتمامات حسابك، وإلغاء المتابعة بيشيلها. تقدر تدير باقي الاهتمامات والتنبيهات من المجتمع." : "Following adds this sport to your profile interests; unfollowing removes it. Manage other interests and alerts in Community."}</p>
      {push.supported && !push.subscribed && <Button variant="outline" size="sm" disabled={push.busy} onClick={async () => {
        const ok = await push.subscribe();
        setMessage(ok ? ar ? "تنبيهات الجهاز اتفعّلت" : "Device notifications enabled" : ar ? "تعذر تفعيل تنبيهات الجهاز. راجع أذونات المتصفح؛ تنبيهات حسابك تظل متاحة." : "Could not enable device notifications. Check browser permissions; alerts remain available in your account.");
      }}>{ar ? "فعّل تنبيهات الجهاز" : "Enable device notifications"}</Button>}
      <Link href="/community" className="block text-sm underline underline-offset-4">{ar ? "إدارة الاهتمامات والتنبيهات" : "Manage interests & alerts"}</Link>
    </>}
    <p role="status" className="text-sm text-muted-foreground">{message}</p>
  </section>;
}


export function GameAlertPreferencesPanel({ returnTo }: { returnTo: string }) {
  const { lang } = useI18n();
  const [sport, setSport] = useState("Volleyball");
  return <div className="space-y-3">
    <label className="block text-sm font-semibold">{lang === "ar" ? "اختار رياضة لمتابعة ماتشاتها" : "Choose a sport to follow"}
      <select className="ms-3 rounded-lg border bg-background px-3 py-2" value={sport} onChange={event => setSport(event.target.value)}>{COMMUNITY_SPORTS.map(name => <option key={name} value={name}>{name}</option>)}</select>
    </label>
    <GameAlertFollow key={sport} sport={sport} returnTo={returnTo} />
  </div>;
}
