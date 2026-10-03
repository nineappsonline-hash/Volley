"use client";

import { KashierButton, type CardPaymentTarget } from "@/components/payments/kashier-button";
import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { E_WALLET_NUMBER, INSTAPAY_LINK, formatMoney } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

type PayMethod = "instapay" | "e_wallet" | "kashier";

const PAY_METHODS: { value: PayMethod; icon: typeof Wallet; disabled?: boolean }[] = [
  { value: "instapay", icon: LinkIcon },
  { value: "e_wallet", icon: Wallet },
  { value: "kashier", icon: CreditCard },
];

/**
 * Share-payment step used right after a game is created (or when joining a
 * game that requires a per-player payment). The member chooses card checkout or pays with InstaPay/an e-wallet
 * and uploads a receipt for review.
 */
export function GameSharePayment({
  amount,
  label,
  submitting,
  onPay,
  note,
  submitLabel,
  cardTarget,
}: {
  amount: number;
  label: string;
  submitting: boolean;
  onPay: (payMethod: "instapay" | "e_wallet", payReceiptUrl: string) => void;
  note?: string;
  submitLabel?: string;
  cardTarget?: CardPaymentTarget;
}) {
  const { t, lang } = useI18n();
  const supabase = createClient();
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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

  const busy = uploading || submitting;
  const amountLabel = formatMoney(amount, lang);

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
        {note ?? t("game_fee_desc").replace("{amount}", amountLabel)}
      </p>

      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <p className="min-w-0 truncate text-xs text-muted-foreground">{label}</p>
        <span className="shrink-0 text-lg font-extrabold text-primary">
          {amountLabel}
        </span>
      </div>

      <div className={cn("grid gap-2", cardTarget ? "grid-cols-3" : "grid-cols-2")}>
        {PAY_METHODS.filter(m=>m.value!=="kashier" || cardTarget).map(({ value, icon: Icon, disabled }) => {
          const selected = payMethod === value;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => setPayMethod(value)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">{t(`game_fee_method_${value}`)}</span>
              {disabled && (
                <span className="text-[9px] text-muted-foreground">{t("game_fee_kashier_soon")}</span>
              )}
            </button>
          );
        })}
      </div>

      {payMethod === "instapay" && (
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{t("checkout_instapay_link")}</p>
            <p className="break-all text-sm font-medium leading-relaxed text-primary">{INSTAPAY_LINK}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a href={INSTAPAY_LINK} target="_blank" rel="noopener noreferrer">
                <LinkIcon className="h-3.5 w-3.5" />
                {t("checkout_open_link")}
              </a>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => copy("instapay", INSTAPAY_LINK)}>
              {copied === "instapay" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {t("checkout_copy")}
            </Button>
          </div>
        </div>
      )}
      {payMethod === "e_wallet" && (
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{t("checkout_e_wallet_number")}</p>
            <p className="break-all text-lg font-extrabold text-primary" dir="ltr">
              {E_WALLET_NUMBER}
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => copy("ewallet", E_WALLET_NUMBER)}>
            {copied === "ewallet" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {t("checkout_copy")}
          </Button>
        </div>
      )}

      {payMethod && payMethod !== "kashier" && (
        <div className="space-y-2">
          <Label>{t("game_fee_receipt")}</Label>
          <label
            className={cn(
              "flex h-10 w-full items-center justify-center gap-2 rounded-md border bg-card px-3 text-sm font-medium transition-colors",
              uploading
                ? "cursor-wait border-input text-muted-foreground"
                : receiptUrl
                  ? "cursor-default border-primary/30 bg-primary/5 text-success-ink"
                  : "cursor-pointer border-border text-foreground hover:border-primary/40",
            )}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : receiptUrl ? (
              <Check className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4 text-primary" />
            )}
            {uploading
              ? t("common_saving")
              : receiptUrl
                ? t("game_fee_receipt_ok")
                : t("game_fee_receipt")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFile}
              disabled={uploading}
            />
          </label>
          <p className="text-xs text-muted-foreground">{t("game_fee_receipt_hint")}</p>
        </div>
      )}

      {payMethod === "kashier" && cardTarget ? <KashierButton target={cardTarget} disabled={busy} /> : <Button
        type="button"
        className="w-full"
        disabled={!payMethod || payMethod === "kashier" || !receiptUrl || busy}
        onClick={() => {
          if (payMethod && payMethod !== "kashier" && receiptUrl) {
            onPay(payMethod, receiptUrl);
          }
        }}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {submitting ? t("common_saving") : (submitLabel ?? t("game_fee_pay")).replace("{amount}", amountLabel)}
      </Button>}
    </div>
  );
}
