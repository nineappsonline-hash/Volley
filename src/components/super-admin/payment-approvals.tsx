"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, Receipt, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { QueryState } from "@/components/shared/query-state";
import { formatTime12h, formatMoneyShort } from "@/lib/constants";
import {
  useAllGamePayments,
  useAllRentPayments,
  useAllSubscriptions,
  useCommunityMembers,
  useReviewParticipantShare,
  useReviewRentPayment,
  useReviewSubscription,
} from "@/lib/queries";

type PayKind = "share" | "rent" | "subscription";
type PayStatus = "pending" | "approved" | "rejected";
type TypeFilter = "all" | PayKind;

interface PaymentRecord {
  key: string;
  kind: PayKind;
  memberId: string | null;
  playerName?: string | null;
  label: string;
  detail: string;
  context: { label: string; value: string }[];
  amount: number;
  method: string | null;
  createdAt: string;
  receiptUrl: string | null;
  bucket: "game-fee-receipts" | "subscription-receipts";
  status: PayStatus;
}

export function PaymentApprovals() {
  const { t, lang, locale } = useI18n();
  const money = (v: number) => formatMoneyShort(v, lang);
  const membersQuery = useCommunityMembers();
  const { data: members } = membersQuery;
  const sharesQuery = useAllGamePayments();
  const { data: shares } = sharesQuery;
  const rentsQuery = useAllRentPayments();
  const { data: rents } = rentsQuery;
  const subscriptionsQuery = useAllSubscriptions();
  const { data: subscriptions } = subscriptionsQuery;
  const reviewShare = useReviewParticipantShare();
  const reviewRent = useReviewRentPayment();
  const reviewSub = useReviewSubscription();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PayStatus>("pending");
  const [openingReceipt, setOpeningReceipt] = useState<string | null>(null);

  const memberName = (id: string) =>
    (members ?? []).find((m) => m.id === id)?.name;
  const memberHandle = (id: string) =>
    (members ?? []).find((m) => m.id === id)?.username;

  const records = useMemo<PaymentRecord[]>(() => {
    const out: PaymentRecord[] = [];
    const copy = (en: string, ar: string) => lang === "ar" ? ar : en;
    const gameContext = (game: NonNullable<typeof shares>[number]["game"], id: string) => {
      const rows = [
        { label: copy("Sport", "الرياضة"), value: game?.sport ?? copy("Not recorded", "غير مسجل") },
        { label: copy("Game date", "موعد الماتش"), value: [game?.game_date, game?.start_time ? formatTime12h(game.start_time, lang) : null].filter(Boolean).join(" · ") },
        { label: copy("Court / location", "الملعب / المكان"), value: [game?.playground?.name ?? game?.location, game?.playground?.area ?? game?.area, game?.playground?.governorate].filter(Boolean).join(" · ") },
        { label: copy("Organizer", "المنظم"), value: game?.creator_name ?? "" },
        { label: copy("Duration", "المدة"), value: game?.duration_hours != null ? `${game.duration_hours} ${copy("hours", "ساعة")}` : "" },
        { label: copy("Game status", "حالة الماتش"), value: game?.status ? t(`community_status_${game.status}` as any) : "" },
        { label: copy("Game reference", "مرجع الماتش"), value: id },
      ];
      return rows.filter(row => row.value);
    };

    for (const p of shares ?? []) {
      out.push({
        key: `share:${p.id}`,
        kind: "share",
        memberId: p.member_id,
        playerName: p.player_name,
        label: t("super_admin_payments_for_share"),
        detail: p.game?.title ?? copy("Game details unavailable", "تفاصيل الماتش غير متاحة"),
        context: [...gameContext(p.game, p.game_id), ...(p.player_name ? [{ label: copy("Player / paid place", "اللاعب / المكان المدفوع"), value: p.player_name }] : [])],
        amount: p.share_amount ?? 0,
        method: p.pay_method,
        createdAt: p.joined_at,
        receiptUrl: p.pay_receipt_url,
        bucket: "game-fee-receipts",
        status: p.pay_status as PayStatus,
      });
    }

    for (const r of rents ?? []) {
      out.push({
        key: `rent:${r.id}`,
        kind: "rent",
        memberId: r.member_id,
        label: t("super_admin_payments_for_rent"),
        detail: r.game?.title ?? copy("Game details unavailable", "تفاصيل الماتش غير متاحة"),
        context: gameContext(r.game, r.game_id),
        amount: r.amount,
        method: r.pay_method,
        createdAt: r.created_at,
        receiptUrl: r.pay_receipt_url,
        bucket: "game-fee-receipts",
        status: r.pay_status as PayStatus,
      });
    }

    for (const s of subscriptions ?? []) {
      const planName = s.plan === "pro" ? t("mplan_tier_pro") : t(`plans_tier_${s.plan}` as any);
      out.push({
        key: `sub:${s.id}`,
        kind: "subscription",
        memberId: s.user_id,
        label: t(
          s.kind === "academy"
            ? "super_admin_payments_for_sub_academy"
            : "super_admin_payments_for_sub_member",
        ),
        detail: `${planName} · ${t(`checkout_cycle_${s.billing_cycle}` as any)}`,
        context: [
          { label: copy("Subscription for", "الاشتراك لصالح"), value: s.kind === "academy" ? s.academy?.name ?? copy("Academy details unavailable", "بيانات الأكاديمية غير متاحة") : copy("Player membership", "عضوية لاعب") },
          { label: copy("Plan", "الباقة"), value: planName },
          { label: copy("Billing cycle", "دورة الفوترة"), value: t(`checkout_cycle_${s.billing_cycle}` as any) },
          ...(s.academy_id ? [{ label: copy("Academy reference", "مرجع الأكاديمية"), value: s.academy_id }] : []),
          ...(s.reviewed_at ? [{ label: copy("Reviewed at", "تاريخ المراجعة"), value: format(new Date(s.reviewed_at), "MMM d, yyyy · h:mm a", { locale }) }] : []),
        ],
        amount: s.amount,
        method: s.method,
        createdAt: s.created_at,
        receiptUrl: s.receipt_url,
        bucket: "subscription-receipts",
        status: s.receipt_status === "verified" ? "approved" : (s.receipt_status as PayStatus),
      });
    }

    return out;
  }, [shares, rents, subscriptions, t, lang, locale]);

  const pendingCount = records.filter((r) => r.status === "pending" && r.method !== "kashier").length;

  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          (typeFilter === "all" || r.kind === typeFilter) &&
          (statusFilter === "all" || r.status === statusFilter),
      ),
    [records, typeFilter, statusFilter],
  );

  const handleApproveReject = async (
    record: PaymentRecord,
    approve: boolean,
  ) => {
    if (record.method === "kashier") return;
    try {
      if (record.kind === "share") {
        const dbId = record.key.slice("share:".length);
        await reviewShare.mutateAsync({ participantId: dbId, approve });
      } else if (record.kind === "rent") {
        const dbId = record.key.slice("rent:".length);
        await reviewRent.mutateAsync({ paymentId: dbId, approve });
      } else {
        const dbId = record.key.slice("sub:".length);
        await reviewSub.mutateAsync({ subscriptionId: dbId, approve });
      }
      toast.success(
        approve ? t("super_admin_fee_approved") : t("super_admin_fee_rejected"),
      );
    } catch (error) {
      toast.error(errorMessage(error, t("common_error")));
    }
  };

  const handleViewReceipt = async (record: PaymentRecord) => {
    if (!record.receiptUrl) return;
    setOpeningReceipt(record.key);
    try {
      const { data, error } = await createClient().storage
        .from(record.bucket)
        .createSignedUrl(record.receiptUrl, 600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("super_admin_payments_receipt_fail"));
    } finally {
      setOpeningReceipt(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4 text-primary" />
          {t("super_admin_payments_title")}
          {pendingCount > 0 && <Badge variant="warning">{pendingCount}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex min-h-9 h-auto max-w-full flex-wrap items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground">
            {(["all", "share", "rent", "subscription"] as TypeFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f)}
                className={[
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-semibold transition-all",
                  typeFilter === f
                    ? "bg-card text-foreground shadow-sm"
                    : "hover:bg-card/50",
                ].join(" ")}
              >
                {t(
                  f === "all"
                    ? "super_admin_payments_all"
                    : f === "share"
                      ? "super_admin_payments_share"
                      : f === "rent"
                        ? "super_admin_payments_rent"
                        : "super_admin_payments_subs",
                )}
              </button>
            ))}
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "all" | PayStatus)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("super_admin_payments_status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-sort={0}>
                {t("super_admin_payments_status_all")}
              </SelectItem>
              <SelectItem value="pending" data-sort={1}>
                {t("super_admin_payments_pending")}
              </SelectItem>
              <SelectItem value="approved" data-sort={2}>
                {t("super_admin_payments_approved")}
              </SelectItem>
              <SelectItem value="rejected" data-sort={3}>
                {t("super_admin_payments_rejected")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <QueryState queries={[sharesQuery, rentsQuery, subscriptionsQuery]}>
        {filtered.length === 0 ? (
          <EmptyState
            message={t("super_admin_payments_empty")}
            icon={Receipt}
          />
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            {filtered.map(r => (
              <article key={r.key} className="min-w-0 space-y-3 rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="min-w-0 break-words font-semibold">{r.label}</h3>
                  <Badge variant={r.status === "pending" ? "warning" : r.status === "approved" ? "success" : "destructive"}>
                    {t(r.status === "pending" ? "super_admin_payments_pending" : r.status === "approved" ? "super_admin_payments_approved" : "super_admin_payments_rejected")}
                  </Badge>
                </div>
                <PaymentPurpose record={r} language={lang} />
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="min-w-0 break-words">{(r.memberId ? memberName(r.memberId) : undefined) ?? r.playerName ?? "—"}</span>
                  <strong>{money(r.amount)}</strong>
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(r.createdAt), "MMM d, yyyy · h:mm a", { locale })}{r.method && <> · {t(`game_fee_method_${r.method}` as any)}</>}</p>
                <div className="flex flex-wrap gap-2">
                  {r.method === "kashier" && <span className="text-xs text-muted-foreground">{lang === "ar" ? (r.status === "pending" ? "بانتظار إتمام الدفع بالبطاقة؛ يتم التأكيد تلقائيًا" : "مدفوعات البطاقة تُراجع تلقائيًا عبر كاشير") : (r.status === "pending" ? "Awaiting card payment; confirmed automatically" : "Card payments are verified automatically by Kashier")}</span>}
                  {r.receiptUrl && <Button variant="outline" className="h-auto min-h-11 whitespace-normal" disabled={openingReceipt !== null} onClick={() => handleViewReceipt(r)}><Eye className="me-1 h-4 w-4 shrink-0" />{t("super_admin_fee_view_receipt")}</Button>}
                  {r.status === "pending" && r.method !== "kashier" && <>
                    <Button variant="outline" className="min-h-11 text-success-ink" disabled={reviewShare.isPending || reviewRent.isPending || reviewSub.isPending} onClick={() => handleApproveReject(r, true)}>{t("super_admin_fee_approve")}</Button>
                    <Button variant="outline" className="min-h-11" disabled={reviewShare.isPending || reviewRent.isPending || reviewSub.isPending} onClick={() => handleApproveReject(r, false)}>{t("super_admin_fee_reject")}</Button>
                  </>}
                </div>
              </article>
            ))}
          </div>
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("super_admin_payments_for_title")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{lang === "ar" ? "صاحب الدفع" : "Payer"}</TableHead>
                  <TableHead>{t("checkout_total")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("super_admin_payments_date")}</TableHead>
                  <TableHead>{t("super_admin_payments_status")}</TableHead>
                  <TableHead className="text-end">{t("super_admin_actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const name = r.memberId ? memberName(r.memberId) : undefined;
                  const handle = r.memberId ? memberHandle(r.memberId) : undefined;
                  return (
                    <TableRow key={r.key}>
                      <TableCell className="min-w-64 max-w-md align-top">
                        <p className="whitespace-normal break-words font-medium">{r.label}</p>
                        <PaymentPurpose record={r} language={lang} />
                        {r.method && <p className="mt-2 text-xs text-muted-foreground">{t(`game_fee_method_${r.method}` as any)}</p>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <p>{name ?? r.playerName ?? "—"}</p>
                        {handle && (
                          <p className="text-xs text-muted-foreground">@{handle}</p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {money(r.amount)}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                        {format(new Date(r.createdAt), "MMM d, yyyy · h:mm a", { locale })}
                      </TableCell>
                      <TableCell>
                        {r.status === "pending" ? (
                          <Badge variant="warning">{t("super_admin_payments_pending")}</Badge>
                        ) : r.status === "approved" ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {t("super_admin_payments_approved")}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            {t("super_admin_payments_rejected")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          {r.method === "kashier" && <span className="text-xs text-muted-foreground">{lang === "ar" ? (r.status === "pending" ? "بانتظار إتمام الدفع بالبطاقة؛ يتم التأكيد تلقائيًا" : "مدفوعات البطاقة تُراجع تلقائيًا عبر كاشير") : (r.status === "pending" ? "Awaiting card payment; confirmed automatically" : "Card payments are verified automatically by Kashier")}</span>}
                  {r.receiptUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              disabled={openingReceipt !== null}
                              onClick={() => handleViewReceipt(r)}
                            >
                              <Eye className="h-3 w-3" />
                              {t("super_admin_fee_view_receipt")}
                            </Button>
                          )}
                          {r.status === "pending" && r.method !== "kashier" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-success-ink hover:text-success-ink"
                                disabled={reviewShare.isPending || reviewRent.isPending || reviewSub.isPending}
                                onClick={() => handleApproveReject(r, true)}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {t("super_admin_fee_approve")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-muted-foreground"
                                disabled={reviewShare.isPending || reviewRent.isPending || reviewSub.isPending}
                                onClick={() => handleApproveReject(r, false)}
                              >
                                <XCircle className="h-3 w-3" />
                                {t("super_admin_fee_reject")}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function PaymentPurpose({ record, language }: { record: PaymentRecord; language: string }) {
  return <div className="mt-2 min-w-0 space-y-2 text-xs">
    <p className="whitespace-normal break-words text-sm font-semibold">{record.detail}</p>
    <dl className="space-y-1">{record.context.map(field => <div key={field.label} className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{field.label}:</dt><dd className="min-w-0 whitespace-normal break-words">{field.value}</dd>
    </div>)}<div className="flex flex-wrap gap-x-2"><dt className="text-muted-foreground">{language === "ar" ? "مرجع الدفع" : "Payment reference"}:</dt><dd className="break-all font-mono text-[10px]">{record.key.slice(record.key.indexOf(":") + 1)}</dd></div></dl>
  </div>;
}
