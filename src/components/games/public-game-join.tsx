"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AppLogo } from "@/components/shared/app-logo";
import { JoinGameDialog } from "./join-game-dialog";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

export function PublicGameJoin({ game, inviteCode }: {
  game: { id: string; title: string; share_price: number | null; host_pays?: boolean; host_total?: number | null };
  inviteCode?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const [signInOpen, setSignInOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [mode, setMode] = useState<"join" | "pay">("join");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function continueToGame(userId: string) {
    const { data: participant, error } = await createClient().from("friendly_game_participants")
      .select("pay_status, is_waitlisted").eq("game_id", game.id).eq("member_id", userId).maybeSingle();
    if (error) throw error;
    if (participant && (participant.is_waitlisted || !["unpaid", "rejected"].includes(participant.pay_status))) {
      router.push("/dashboard");
      return;
    }
    setMode(participant ? "pay" : "join");
    setPaymentOpen(true);
  }

  async function join() {
    setBusy(true);
    try {
      const { data: { user }, error } = await createClient().auth.getUser();
      if (!user) { setSignInOpen(true); return; }
      if (error) throw error;
      await continueToGame(user.id);
    } catch { toast.error(t("common_error")); }
    finally { setBusy(false); }
  }

  return <>
    <Button className="w-full" disabled={busy} onClick={() => void join()}>{t("community_join")}</Button>
    <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
      <DialogContent>
        <AppLogo />
        <DialogHeader><DialogTitle>{t("login_title")}</DialogTitle><DialogDescription>{game.title}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault(); setBusy(true);
          try {
            const { data, error } = await createClient().auth.signInWithPassword({ email, password });
            if (error || !data.user) { toast.error(t("login_error")); return; }
            await qc.invalidateQueries();
            setPassword(""); setSignInOpen(false);
            await continueToGame(data.user.id);
            router.refresh();
          } catch { toast.error(t("common_error")); }
          finally { setBusy(false); }
        }}>
          <Label className="block">{t("login_email")}<Input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Label>
          <Label className="block">{t("login_password")}<Input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></Label>
          <Button type="submit" disabled={busy}>{t("login_button")}</Button>
          <Link className="block text-sm text-info-ink" href={inviteCode ? `/signup?gameInvite=${encodeURIComponent(inviteCode)}` : "/signup"}>{t("login_signup_link")}</Link>
        </form>
      </DialogContent>
    </Dialog>
    <JoinGameDialog open={paymentOpen} onOpenChange={setPaymentOpen} game={game} inviteCode={inviteCode} mode={mode} onSuccess={() => { router.push("/dashboard"); router.refresh(); }} />
  </>;
}
