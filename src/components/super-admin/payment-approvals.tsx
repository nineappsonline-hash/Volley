"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, Eye, Receipt, XCircle } from "lucide-react";
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
  useCardPaymentOrders,
  useAllGamePayments,
  useAllRentPayments,
  useAllSubscriptions,
  useCommunityMembers,
  useReviewParticipantShare,
  useReviewRentPayment,
  useReviewSubscription,
} from "@/lib/queries";

import { paymentReviewStatus, type PaymentReviewStatus } from "@/lib/payments/review-status";

type PayKind = "share" | "rent" | "subscription";
type PayStatus = PaymentReviewStatus;
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
  orderId?: string;
}

export function PaymentApprovals() {
  const { t, lang, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const money = (v: number) => formatMoneyShort(v, lang);
  const membersQuery = useCommunityMembers();
  const { data: members } = membersQuery;
  const sharesQuery = useAllGamePayments();
  const { data: shares } = sharesQuery;
  const rentsQuery = useAllRentPayments();
  const { data: rents } = rentsQuery;
  const subscriptionsQuery = useAllSubscriptions();
  const { data: subscriptions } = subscriptionsQuery;
  const cardOrdersQuery = useCardPaymentOrders();
  const { data: cardOrders } = cardOrdersQuery;
  const [cardBusy, setCardBusy] = useState(false);
  const refreshed = useRef(false);
  const reloadPayments = async () => {
    await Promise.all([sharesQuery.refetch(), rentsQuery.refetch(), subscriptionsQuery.refetch(), cardOrdersQuery.refetch()]);
  };
  const refreshCards = async () => {
    setCardBusy(true);
    try {
      const response = await fetch("/api/platform-admin/card-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await reloadPayments();
      if (result.unavailable) toast.error(lang === "ar" ? "تعذر التحقق من بعض المدفوعات. راجع كاشير قبل الموافقة يدويًا." : "Some payments could not be verified. Check Kashier before approving manually.");
    } catch (error) { toast.error(errorMessage(error, t("common_error"))); }
    finally { setCardBusy(false); }
  };
  useEffect(() => {
    if (expanded && !refreshed.current) { refreshed.current = true; void refreshCards(); }
  // Refresh once on opening, never on a query update or rerender.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);
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

    return out.map(record => {
      const order = cardOrders?.find(o => o.kind === record.kind && o.target_id === record.key.slice(record.key.indexOf(":") + 1));
      return { ...record, orderId: order?.id, status: paymentReviewStatus(record.status, record.method, order) };
    });
  }, [shares, rents, subscriptions, cardOrders, t, lang, locale]);

  const pendingCount = records.filter((r) => r.status === "pending" || r.status === "review_required").length;

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
    if (record.method === "kashier" && !window.confirm(lang === "ar"
      ? (approve ? "تأكيد الموافقة يدويًا؟ تحقق من استلام المبلغ في كاشير أولًا. لن يتم خصم أي مبلغ." : "رفض سجل الدفع؟ هذا لا يُعيد المبلغ للبطاقة. أي استرداد يتم من كاشير بشكل منفصل.")
      : (approve ? "Approve manually? Verify receipt of funds in Kashier first. This will not charge the card." : "Reject this payment record? This does not refund the card. Any refund must be handled separately in Kashier."))) return;
    try {
      if (record.method === "kashier") {
        setCardBusy(true);
        const response = await fetch("/api/platform-admin/card-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", orderId: record.orderId, approve }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        await reloadPayments();
      } else if (record.kind === "share") {
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
    } finally { setCardBusy(false); }
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

  const statusLabel = (status: PayStatus) => status === "awaiting_payment" ? (lang === "ar" ? "بانتظار الدفع بالبطاقة" : "Awaiting card payment") : status === "review_required" ? (lang === "ar" ? "تم الدفع — يحتاج مراجعة" : "Paid — needs review") : t(status === "pending" ? "super_admin_payments_pending" : status === "approved" ? "super_admin_payments_approved" : "super_admin_payments_rejected");
  const statusBadge = (status: PayStatus) => <Badge variant={status === "approved" ? "success" : status === "rejected" ? "destructive" : "warning"}>{statusLabel(status)}</Badge>;
  const cardNote = (r: PaymentRecord) => r.method === "kashier" ? <span className="text-xs text-muted-foreground">{lang === "ar" ? "قرار الإدارة لا يخصم أو يُعيد أي مبلغ من كاشير." : "Admin review does not charge or refund Kashier payments."}</span> : null;
  const actions = (r: PaymentRecord) => (r.method === "kashier" ? !!r.orderId : r.status === "pending") && <>
    {r.status !== "approved" && <Button variant="outline" size="sm" disabled={cardBusy || reviewShare.isPending || reviewRent.isPending || reviewSub.isPending} onClick={() => void handleApproveReject(r, true)}><CheckCircle2 className="me-1 h-3 w-3" />{t("super_admin_fee_approve")}</Button>}
    {r.status !== "rejected" && <Button variant="outline" size="sm" disabled={cardBusy || reviewShare.isPending || reviewRent.isPending || reviewSub.isPending} onClick={() => void handleApproveReject(r, false)}><XCircle className="me-1 h-3 w-3" />{t("super_admin_fee_reject")}</Button>}
  </>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <button type="button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 rounded text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Receipt className="h-4 w-4 text-primary" />
          {t("super_admin_payments_title")}
          {pendingCount > 0 && <Badge variant="warning">{pendingCount}</Badge>}
          <ChevronDown className={`ms-auto h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent id={contentId} hidden={!expanded} className="space-y-3">
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
          <Button variant="outline" size="sm" disabled={cardBusy} onClick={() => void refreshCards()}>{lang === "ar" ? "تحديث مدفوعات كاشير" : "Refresh Kashier payments"}</Button>
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
              <SelectItem value="awaiting_payment">{lang === "ar" ? "بانتظار الدفع بالبطاقة" : "Awaiting card payment"}</SelectItem>
              <SelectItem value="review_required">{lang === "ar" ? "تم الدفع — يحتاج مراجعة" : "Paid — needs review"}</SelectItem>
              <SelectItem value="approved" data-sort={2}>
                {t("super_admin_payments_approved")}
              </SelectItem>
              <SelectItem value="rejected" data-sort={3}>
                {t("super_admin_payments_rejected")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <QueryState queries={[sharesQuery, rentsQuery, subscriptionsQuery, cardOrdersQuery]}>
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
                  {statusBadge(r.status)}
                </div>
                <PaymentPurpose record={r} language={lang} />
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="min-w-0 break-words">{(r.memberId ? memberName(r.memberId) : undefined) ?? r.playerName ?? "—"}</span>
                  <strong>{money(r.amount)}</strong>
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(r.createdAt), "MMM d, yyyy · h:mm a", { locale })}{r.method && <> · {t(`game_fee_method_${r.method}` as any)}</>}</p>
                <div className="flex flex-wrap gap-2">
                  {cardNote(r)}
                  {r.receiptUrl && <Button variant="outline" className="h-auto min-h-11 whitespace-normal" disabled={openingReceipt !== null} onClick={() => handleViewReceipt(r)}><Eye className="me-1 h-4 w-4 shrink-0" />{t("super_admin_fee_view_receipt")}</Button>}
                  {actions(r)}
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
                        {statusBadge(r.status)}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          {cardNote(r)}
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
                          {actions(r)}
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
    <details className="group/purpose">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded py-1 font-medium text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">{language === "ar" ? "تفاصيل الدفع" : "Payment details"}<ChevronDown className="h-3.5 w-3.5 transition-transform group-open/purpose:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary>
      <dl className="mt-1 space-y-1">{record.context.map(field => <div key={field.label} className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{field.label}:</dt><dd className="min-w-0 whitespace-normal break-words">{field.value}</dd>
    </div>)}<div className="flex flex-wrap gap-x-2"><dt className="text-muted-foreground">{language === "ar" ? "مرجع الدفع" : "Payment reference"}:</dt><dd className="break-all font-mono text-[10px]">{record.key.slice(record.key.indexOf(":") + 1)}</dd></div></dl>
    </details>
  </div>;
}
