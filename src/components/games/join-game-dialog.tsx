"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  CreditCard,
  Loader2,
  Link as LinkIcon,
  Upload,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import {
  E_WALLET_NUMBER,
  INSTAPAY_LINK,
  formatMoney,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { requestPushPrompt } from "@/lib/push";
import { useJoinFriendlyGame, usePayGameShare } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";

type PayMethod = "instapay" | "e_wallet" | "kashier";

const PAY_METHODS: { value: PayMethod; icon: typeof Wallet; disabled?: boolean }[] =
  [
    { value: "instapay", icon: LinkIcon },
    { value: "e_wallet", icon: Wallet },
    { value: "kashier", icon: CreditCard, disabled: true },
  ];

export function JoinGameDialog({
  open,
  onOpenChange,
  game,
  inviteCode,
  mode = "join",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: {
    id: string;
    title: string;
    share_price: number | null;
    host_pays?: boolean;
    host_total?: number | null;
  };
  inviteCode?: string | null;
  mode?: "join" | "pay";
}) {
  const { t, lang } = useI18n();
  const supabase = createClient();
  const join = useJoinFriendlyGame();
  const pay = usePayGameShare();
  const isPay = mode === "pay";

  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPayMethod(null);
      setReceiptUrl("");
      setUploading(false);
      setCopied(null);
    }
  }, [open]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void uploadReceipt(file);
  };

  const uploadReceipt = async (file: File) => {
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("game-fee-receipts")
        .upload(path, file, { cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      setReceiptUrl(path);
      toast.success(t("game_fee_receipt_ok"));
    } catch {
      toast.error(t("game_fee_receipt_fail"));
    } finally {
      setUploading(false);
    }
  };

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const amount = game.host_pays
    ? mode === "pay"
      ? game.host_total ?? 0
      : 0
    : (game.share_price ?? 0);
  const isFree = game.host_pays === true && mode === "join";
  const busy = join.isPending || pay.isPending;

  const submit = async () => {
    if (isFree) {
      try {
        const added = await join.mutateAsync({
          gameId: game.id,
          inviteCode,
          payMethod: null,
          payReceiptUrl: null,
        });
        toast.success(added ? t("games_waitlist_joined") : t("community_joined"));
        requestPushPrompt();
        onOpenChange(false);
      } catch (err) {
        toast.error(errorMessage(err, t("common_error")));
      }
      return;
    }
    if (!payMethod || payMethod === "kashier") return;
    if (!receiptUrl) {
      toast.error(t("game_fee_receipt_required"));
      return;
    }
    try {
      if (isPay) {
        await pay.mutateAsync({
          gameId: game.id,
          payMethod,
          payReceiptUrl: receiptUrl,
        });
        toast.success(t("games_share_submitted"));
      } else {
        const added = await join.mutateAsync({
          gameId: game.id,
          inviteCode,
          payMethod,
          payReceiptUrl: receiptUrl,
        });
        toast.success(added ? t("games_waitlist_joined") : t("community_joined"));
        requestPushPrompt();
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const canSubmit = isFree
    ? !busy
    : !!payMethod &&
      payMethod !== "kashier" &&
      !!receiptUrl &&
      !uploading &&
      !busy &&
      amount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isPay
              ? t("games_share_pay_title")
              : isFree
                ? t("games_free_join_title")
                : t("games_share_join_title")}
          </DialogTitle>
          <DialogDescription>
            {isFree ? t("games_free_join_desc") : t("games_share_join_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {isFree
                  ? t("games_free_price")
                  : game.host_pays
                    ? t("games_host_pays")
                    : t("games_share_per_player")}
              </p>
              <p className="truncate text-sm font-semibold">{game.title}</p>
            </div>
            {isFree ? (
              <span className="shrink-0 text-lg font-extrabold text-success-ink">
                {t("games_free_label")}
              </span>
            ) : (
              <span className="shrink-0 text-lg font-extrabold text-primary">
                {formatMoney(amount, lang)}
              </span>
            )}
          </div>

          {!isFree && amount <= 0 && (
            <p className="text-xs text-muted-foreground">
              {t("games_share_unavailable")}
            </p>
          )}

          {!isFree && (
            <>
            <div className="grid grid-cols-3 gap-2">
            {PAY_METHODS.map(({ value, icon: Icon, disabled }) => {
              const selected = payMethod === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setPayMethod(value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">
                    {t(`game_fee_method_${value}`)}
                  </span>
                  {disabled && (
                    <span className="text-[9px] text-muted-foreground">
                      {t("game_fee_kashier_soon")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {payMethod === "instapay" && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("checkout_instapay_link")}
                </p>
                <p className="truncate text-sm font-medium text-primary">
                  {INSTAPAY_LINK}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={INSTAPAY_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    {t("checkout_open_link")}
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => copy("instapay", INSTAPAY_LINK)}
                >
                  {copied === "instapay" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {t("checkout_copy")}
                </Button>
              </div>
            </div>
          )}
          {payMethod === "e_wallet" && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("checkout_e_wallet_number")}
                </p>
                <p
                  className="text-lg font-extrabold text-primary"
                  dir="ltr"
                >
                  {E_WALLET_NUMBER}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => copy("ewallet", E_WALLET_NUMBER)}
              >
                {copied === "ewallet" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {t("checkout_copy")}
              </Button>
            </div>
          )}

          {payMethod && payMethod !== "kashier" && (
            <div className="space-y-2">
              <Label>{t("game_fee_receipt")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  disabled={uploading}
                />
                {uploading && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                )}
                {receiptUrl && !uploading && (
                  <Upload className="h-4 w-4 shrink-0 text-success-ink" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("game_fee_receipt_hint")}
              </p>
            </div>
          )}
            </>
          )}

          {isPay && game.host_pays && (
            <p className="rounded-lg border border-attention-300/60 bg-attention-50 p-2.5 text-[11px] text-warning-ink dark:bg-attention-500/10 dark:text-attention-300">
              {t("games_host_cover_note")}
            </p>
          )}

          {!game.host_pays && (
            <p className="rounded-lg border border-attention-300/60 bg-attention-50 p-2.5 text-[11px] text-warning-ink dark:bg-attention-500/10 dark:text-attention-300">
              {t("games_share_refund_note")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={submit} disabled={!canSubmit} className="gap-1">
            <Wallet className="h-4 w-4" />
            {busy
              ? t("common_saving")
              : isFree
                ? t("games_free_join")
                : isPay
                  ? t("games_share_pay_submit")
                  : t("games_share_pay_join").replace(
                      "{amount}",
                      formatMoney(amount, lang)
                    )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}