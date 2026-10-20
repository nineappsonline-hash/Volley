"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JoinGameDialog } from "./join-game-dialog";
import { createClient } from "@/lib/supabase/client";
import { authLink } from "@/lib/auth-redirect";
import { useI18n } from "@/lib/i18n";

export function PublicGameJoin({ game, inviteCode, returnTo }: {
  game: { id: string; title: string; share_price: number | null; host_pays?: boolean; host_total?: number | null; game_date?: string; start_time?: string; location?: string | null; area?: string | null; max_players?: number; participants_count?: number; status?: string };
  inviteCode?: string;
  returnTo?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [mode, setMode] = useState<"join" | "pay">("join");
  const [busy, setBusy] = useState(false);
  const destination = returnTo ?? (inviteCode ? `/games?join=${encodeURIComponent(inviteCode)}` : `${pathname}${params.size ? `?${params}` : ""}`);
  async function join() {
    setBusy(true);
    try {
      const client = createClient();
      const { data: { user }, error } = await client.auth.getUser();
      if (!user) { router.push(authLink("/login", destination)); return; }
      if (error) throw error;
      const { data: participant, error: participantError } = await client.from("friendly_game_participants")
        .select("pay_status, is_waitlisted").eq("game_id", game.id).eq("member_id", user.id).maybeSingle();
      if (participantError) throw participantError;
      if (participant && (participant.is_waitlisted || !["unpaid", "rejected"].includes(participant.pay_status))) {
        router.push(`/dashboard/my-games?focus=${encodeURIComponent(game.id)}#game-${game.id}`); return;
      }
      setMode(participant ? "pay" : "join");
      setPaymentOpen(true);
    } catch { toast.error(t("common_error")); }
    finally { setBusy(false); }
  }
  return <>
    <Button className="w-full" disabled={busy} onClick={() => void join()}>{t("community_join")}</Button>
    <JoinGameDialog open={paymentOpen} onOpenChange={setPaymentOpen} game={game} inviteCode={inviteCode} mode={mode} onSuccess={() => { router.refresh(); }} />
  </>;
}
