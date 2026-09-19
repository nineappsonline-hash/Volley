"use client";

import { useEffect, useRef, useState, type Ref, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  Link as LinkIcon,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  Wallet,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n, type Dict } from "@/lib/i18n";
import { E_WALLET_NUMBER, INSTAPAY_LINK } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import {
  useAcademy,
  useMySubscriptions,
  usePurchasePlanSubscription,
} from "@/lib/queries";
import type { PlanSubscription, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "academy" | "member";
type AcademyTier = "starter" | "plus" | "elite";
type Cycle = "monthly" | "semi" | "yearly";
type Method = "instapay" | "e_wallet" | "kashier";

const ACADEMY_PRICES: Record<AcademyTier, Partial<Record<Cycle, number>>> = {
  starter: {},
  plus: { monthly: 600, yearly: 6000 },
  elite: { monthly: 999, yearly: 9990 },
};

const MEMBER_PRICES: Record<"pro", Record<Cycle, number>> = {
  pro: { monthly: 100, semi: 500, yearly: 1000 },
};

const ACADEMY_CYCLES: Cycle[] = ["monthly", "yearly"];
const MEMBER_CYCLES: Cycle[] = ["monthly", "semi", "yearly"];

const RECEIPT_METHODS: Method[] = ["instapay", "e_wallet"];

function amountFor(kind: Kind, plan: string, cycle: Cycle): number | null {
  if (kind === "member") {
    return MEMBER_PRICES.pro[cycle];
  }
  const tier = plan as AcademyTier;
  return ACADEMY_PRICES[tier][cycle] ?? null;
}

const METHOD_META: Record<Method, { icon: typeof Wallet }> = {
  instapay: { icon: LinkIcon },
  e_wallet: { icon: Wallet },
  kashier: { icon: CreditCard },
};

export function CheckoutClient({ profile }: { profile: Profile }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const { data: academy } = useAcademy();
  const mySubs = useMySubscriptions();
  const purchase = usePurchasePlanSubscription();

  const isAdmin = profile.role === "admin";
  const paramKind = searchParams.get("kind");
  const paramPlan = searchParams.get("plan");

  const [kind, setKind] = useState<Kind>(
    (paramKind === "academy" && isAdmin) || (paramKind === "member" && !isAdmin)
      ? (paramKind as Kind)
      : isAdmin
        ? "academy"
        : "member"
  );
  const [academyTier, setAcademyTier] = useState<AcademyTier>(
    paramPlan === "plus" || paramPlan === "elite" || paramPlan === "starter"
      ? paramPlan
      : "plus"
  );
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [method, setMethod] = useState<Method>("instapay");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCycle("monthly");
  }, [kind]);

  const currentAcademyPlan = academy?.plan ?? null;
  const isPremium = profile.member_plan === "premium";

  const plan =
    kind === "academy"
      ? (academyTier === "starter" ? ("plus" as const) : academyTier)
      : ("pro" as const);
  const amount = amountFor(kind, plan, cycle);
  const cycles = kind === "academy" ? ACADEMY_CYCLES : MEMBER_CYCLES;
  const needReceipt = RECEIPT_METHODS.includes(method);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("subscription-receipts")
        .upload(path, file, { cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      setReceiptUrl(path);
      toast.success(t("checkout_screenshot_ok"));
    } catch {
      toast.error(t("checkout_screenshot_fail"));
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

  const canPay =
    amount !== null && !uploading && !(kind === "academy" && academyTier === "starter");

  const handlePay = async () => {
    if (!amount) return;
    if (method === "kashier") {
      toast.error(t("checkout_method_kashier_soon"));
      return;
    }
    if (needReceipt && !receiptUrl) {
      toast.error(t("checkout_screenshot_required"));
      return;
    }
    try {
      await purchase.mutateAsync({
        kind,
        plan,
        billingCycle: cycle,
        method,
        receiptUrl: needReceipt ? receiptUrl : null,
      });
      toast.success(t("checkout_success"));
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error(t("common_error"));
    }
  };

  const cellFor = (tier: AcademyTier) => {
    const isCurrent = currentAcademyPlan === tier;
    const price = ACADEMY_PRICES[tier].monthly;
    const selected = academyTier === tier;
    return (
      <button
        key={tier}
        type="button"
        disabled={isCurrent}
        onClick={() => setAcademyTier(tier)}
        className={cn(
          "relative flex flex-col items-start gap-1 rounded-xl border p-4 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-70",
          selected
            ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
            : "hover:border-primary/30",
          isCurrent && "opacity-70"
        )}
      >
        {tier === "plus" && (
          <Badge className="absolute -top-2.5 end-2 bg-warning text-warning-foreground dark:bg-attention-500">
            <Sparkles className="me-1 h-3 w-3" />
            {t("plans_popular")}
          </Badge>
        )}
        {tier === "elite" && (
          <Crown className="absolute -top-2.5 end-3 h-4 w-4 text-warning-ink" />
        )}
        <span className="text-sm font-semibold">
          {t(`plans_tier_${tier}` as keyof Dict)}
        </span>
        <span className="text-xs text-muted-foreground">
          {t(`plans_tagline_${tier}` as keyof Dict)}
        </span>
        <span className="mt-1 text-lg font-extrabold">
          {tier === "starter"
            ? t("plans_free")
            : `${price} ${t("currency_egp")} / ${t("plans_per_month")}`}
        </span>
        {isCurrent ? (
          <span className="text-xs font-medium text-primary">{t("plans_current")}</span>
        ) : selected ? (
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> {t("plans_choose")}
          </span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">
            {t("plans_choose")}
          </span>
        )}
      </button>
    );
  };

  const statusStyles: Record<PlanSubscription["receipt_status"], string> = {
    pending: "bg-attention-500/15 text-warning-ink dark:text-attention-400",
    verified: "bg-positive-500/15 text-success-ink dark:text-positive-400",
    rejected: "bg-negative-500/15 text-error-ink dark:text-negative-400",
  };

  const statusIcon: Record<PlanSubscription["receipt_status"], typeof Check> = {
    pending: AlertTriangle,
    verified: CheckCircle2,
    rejected: XCircle,
  };

  const formatDate = (iso: string) =>
    format(new Date(iso), "MMM d, yyyy", { locale: lang === "ar" ? undefined : undefined });

  return (
    <div className="space-y-6">
      <PageHeader title={t("checkout_page_title")} subtitle={t("checkout_page_subtitle")} />

      {isAdmin && (
        <Tabs
          value={kind}
          onValueChange={(v) => setKind(v as Kind)}
          className="w-full"
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="academy" className="flex-1 sm:flex-none">
              {t("checkout_for_academy")}
            </TabsTrigger>
            <TabsTrigger value="member" className="flex-1 sm:flex-none">
              {t("checkout_for_member")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left column: plan → cycle → method */}
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              {kind === "academy" ? t("checkout_academy_tab") : t("checkout_member_tab")}
            </h2>
            {kind === "academy" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {(["starter", "plus", "elite"] as AcademyTier[]).map(cellFor)}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  disabled
                  className="flex flex-col items-start gap-1 rounded-xl border p-4 text-start opacity-70"
                >
                  <span className="text-sm font-semibold">{t("mplan_tier_free")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("mplan_free_note")}
                  </span>
                  <span className="mt-1 text-lg font-extrabold">{t("plans_free")}</span>
                </button>
                <button
                  type="button"
                  className="relative flex flex-col items-start gap-1 rounded-xl border border-attention-400/60 p-4 text-start"
                >
                  <Badge className="absolute -top-2.5 end-2 bg-warning text-warning-foreground dark:bg-attention-500">
                    <Sparkles className="me-1 h-3 w-3" />
                    {t("plans_popular")}
                  </Badge>
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Crown className="h-4 w-4 text-warning-ink" />
                    {t("mplan_tier_pro")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("mplan_page_subtitle")}
                  </span>
                  <span className="mt-1 text-lg font-extrabold">
                    100 {t("currency_egp")} / {t("plans_per_month")}
                  </span>
                  {isPremium ? (
                    <span className="text-xs font-medium text-primary">
                      {t("plans_current")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t("plans_choose")}
                    </span>
                  )}
                </button>
              </div>
            )}
          </section>

          {amount !== null && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("checkout_choose_cycle")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {cycles.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCycle(c)}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                      cycle === c
                        ? "border-primary/60 bg-primary/5 text-primary"
                        : "text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {t(`checkout_cycle_${c}` as keyof Dict)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {amount !== null && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{t("checkout_method")}</h2>
              <div className="grid gap-3">
                {(Object.keys(METHOD_META) as Method[]).map((m) => {
                  const Icon = METHOD_META[m].icon;
                  const disabled = m === "kashier";
                  const selected = method === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={disabled}
                      onClick={() => setMethod(m)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-4 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        selected
                          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                          : "hover:border-primary/30"
                      )}
                    >
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {t(`checkout_method_${m}` as keyof Dict)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t(`checkout_method_${m}_hint` as keyof Dict)}
                        </p>
                        {disabled && (
                          <p className="mt-1 text-[11px] font-medium text-warning-ink">
                            {t("checkout_method_kashier_soon")}
                          </p>
                        )}
                      </div>
                      {selected && (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedMethodInstructions(method, t, copy, copied, fileRef, handleUpload, uploading, receiptUrl)}
            </section>
          )}
        </div>

        {/* Right column: summary + pay */}
        {amount !== null && (
          <aside className="space-y-4 self-start lg:sticky lg:top-24">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("checkout_summary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("checkout_plan")}</span>
                  <span className="font-semibold">
                    {kind === "academy"
                      ? t(`plans_tier_${academyTier}` as keyof Dict)
                      : t("mplan_tier_pro")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("checkout_choose_cycle")}</span>
                  <span className="font-semibold">
                    {t(`checkout_cycle_${cycle}` as keyof Dict)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("checkout_method")}</span>
                  <span className="font-semibold">{t(`checkout_method_${method}` as keyof Dict)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="font-semibold">{t("checkout_total")}</span>
                  <span className="text-lg font-extrabold">
                    {amount} {t("currency_egp")}
                  </span>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-brand to-interactive-700 text-white hover:from-brand hover:to-interactive-800"
                  disabled={!canPay || purchase.isPending}
                  onClick={handlePay}
                >
                  {purchase.isPending ? "…" : t("checkout_pay_now")}
                </Button>
                <div className="flex items-start gap-2 rounded-lg border border-attention-300/60 bg-attention-50 p-3 text-xs dark:bg-attention-500/10">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" />
                  <p className="text-warning-ink dark:text-attention-300">
                    <span className="font-semibold">{t("checkout_warning_title")}: </span>
                    {t("checkout_warning_body")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        )}
      </div>

      {/* Purchase history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" />
            {t("checkout_history")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!mySubs.data || mySubs.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("checkout_history_empty")}</p>
          ) : (
            <ul className="divide-y">
              {mySubs.data.map((s) => {
                const StatusIcon = statusIcon[s.receipt_status];
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {s.kind === "member" ? t("sub_kind_member") : t("sub_kind_academy")} ·{" "}
                        {s.kind === "academy"
                          ? t(`plans_tier_${s.plan === "plus" ? "plus" : "elite"}` as keyof Dict)
                          : t("mplan_tier_pro")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(s.created_at)} · {s.amount} {t("currency_egp")} ·{" "}
                        {t(`checkout_cycle_${s.billing_cycle}` as keyof Dict)}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("gap-1", statusStyles[s.receipt_status])}>
                      <StatusIcon className="h-3 w-3" />
                      {t(`sub_status_${s.receipt_status}` as keyof Dict)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function selectedMethodInstructions(
  method: Method,
  t: (key: keyof Dict) => string,
  copy: (key: string, value: string) => void,
  copied: string | null,
  fileRef: RefObject<HTMLInputElement | null>,
  handleUpload: (file: File) => void,
  uploading: boolean,
  receiptUrl: string | null
) {
  if (method === "kashier") return null;

  return (
    <div className="space-y-4 rounded-xl border p-4">
      {method === "instapay" && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">
              {t("checkout_instapay_link")}
            </p>
            <p className="truncate text-sm font-medium text-primary">{INSTAPAY_LINK}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={INSTAPAY_LINK} target="_blank" rel="noopener noreferrer">
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

      {method === "e_wallet" && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("checkout_e_wallet_number")}
            </p>
            <p className="text-lg font-extrabold text-primary" dir="ltr">
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

      <div className="space-y-2">
        <Label>{t("checkout_screenshot")}</Label>
        <div className="flex items-center gap-3">
          <Input
            ref={fileRef as unknown as Ref<HTMLInputElement>}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <UploadCloud className="h-4 w-4" />
            {uploading ? "…" : t("checkout_screenshot")}
          </Button>
          {receiptUrl && (
            <span className="flex items-center gap-1 text-xs font-medium text-success-ink">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("checkout_screenshot_ok")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("checkout_screenshot_hint")}</p>
      </div>
    </div>
  );
}