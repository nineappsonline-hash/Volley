"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, Eye, Receipt, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  payerName?: string;
  payerShare?: number;
  guests?: { id: string; player_name: string; share_amount: number | null }[];
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
  const [paymentTab, setPaymentTab] = useState<"approvals" | "kashier">("approvals");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PayStatus>("all");
  const [approvalPage, setApprovalPage] = useState(1);
  const [kashierPage, setKashierPage] = useState(1);
  const pageSize = 10;
  const [receiptPreview, setReceiptPreview] = useState<{ url: string | null; path: string } | null>(null);
  const [receiptError, setReceiptError] = useState(false);
  const receiptRequest = useRef(0);
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
      if (p.sponsor_participant_id) continue;
      const guests = p.guests ?? [];
      out.push({
        key: `share:${p.id}`,
        kind: "share",
        memberId: p.member_id,
        playerName: p.player_name,
        label: p.is_waitlisted ? copy("Waiting-list payment", "دفع قائمة الانتظار") : t("super_admin_payments_for_share"),
        detail: p.game?.title ?? copy("Game details unavailable", "تفاصيل الماتش غير متاحة"),
        context: [...gameContext(p.game, p.game_id), ...(p.player_name ? [{ label: copy("Player / paid place", "اللاعب / المكان المدفوع"), value: p.player_name }] : [])],
        payerName: (p.member_id ? members?.find(member => member.id === p.member_id)?.name : undefined) ?? p.player_name ?? copy("Payer", "صاحب الدفع"),
        payerShare: Number(p.share_amount ?? 0),
        guests,
        amount: Number(p.share_amount ?? 0) + guests.reduce((sum, guest) => sum + Number(guest.share_amount ?? 0), 0),
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
  }, [shares, rents, subscriptions, cardOrders, members, t, lang, locale]);

  // Unverified Kashier checkouts are not safe to approve.
  const priorityRecords = useMemo(() => records.filter(r =>
    (r.status === "pending" && r.method !== "kashier") ||
    (r.status === "review_required" && r.method === "kashier" && !!r.orderId)
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [records]);
  const pendingCount = priorityRecords.length;

  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          (typeFilter === "all" || r.kind === typeFilter) &&
          (statusFilter === "all" || r.status === statusFilter),
      ),
    [records, typeFilter, statusFilter],
  );


  const sortedFiltered = useMemo(() => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [filtered]);
  const approvalPageCount = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const currentApprovalPage = Math.min(approvalPage, approvalPageCount);
  const visibleApprovals = sortedFiltered.slice((currentApprovalPage - 1) * pageSize, currentApprovalPage * pageSize);
  const sortedKashier = useMemo(() => [...(cardOrders ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [cardOrders]);
  const kashierPageCount = Math.max(1, Math.ceil(sortedKashier.length / pageSize));
  const currentKashierPage = Math.min(kashierPage, kashierPageCount);
  const visibleKashier = sortedKashier.slice((currentKashierPage - 1) * pageSize, currentKashierPage * pageSize);
  const pagination = (page: number, totalPages: number, totalItems: number, change: (page: number) => void) => totalItems > pageSize && (
    <nav aria-label={lang === "ar" ? "صفحات المدفوعات" : "Payment pages"} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">
        {lang === "ar" ? "عرض" : "Showing"} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} {lang === "ar" ? "من" : "of"} {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => change(page - 1)}>{lang === "ar" ? "السابق" : "Previous"}</Button>
        <span className="min-w-16 text-center text-xs font-semibold text-foreground">{page} / {totalPages}</span>
        <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => change(page + 1)}>{lang === "ar" ? "التالي" : "Next"}</Button>
      </div>
    </nav>
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
    const request = ++receiptRequest.current;
    setReceiptPreview({ url: null, path: record.receiptUrl });
    setReceiptError(false);
    setOpeningReceipt(record.key);
    try {
      const { data, error } = await createClient().storage
        .from(record.bucket)
        .createSignedUrl(record.receiptUrl, 600);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Receipt URL unavailable");
      if (request === receiptRequest.current) setReceiptPreview({ url: data.signedUrl, path: record.receiptUrl });
    } catch {
      if (request === receiptRequest.current) setReceiptError(true);
    } finally {
      if (request === receiptRequest.current) setOpeningReceipt(null);
    }
  };

  const statusLabel = (status: PayStatus) => status === "awaiting_payment" ? (lang === "ar" ? "بانتظار الدفع بالبطاقة" : "Awaiting card payment") : status === "review_required" ? (lang === "ar" ? "تم الدفع — يحتاج مراجعة" : "Paid — needs review") : t(status === "pending" ? "super_admin_payments_pending" : status === "approved" ? "super_admin_payments_approved" : "super_admin_payments_rejected");
  const statusBadge = (status: PayStatus) => {
    const palette = status === "approved"
      ? { color: "#F0FFF6", backgroundColor: "#166534", borderColor: "#4ADE80" }
      : status === "rejected"
        ? { color: "#FFF1F2", backgroundColor: "#991B1B", borderColor: "#F87171" }
        : { color: "#FFFFFF", backgroundColor: "#1D4ED8", borderColor: "#60A5FA" };
    return <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold leading-none" style={palette}>{statusLabel(status)}</span>;
  };
  const cardNote = (r: PaymentRecord) => r.method === "kashier" ? <span className="text-xs text-muted-foreground">{lang === "ar" ? "قرار الإدارة لا يخصم أو يُعيد أي مبلغ من كاشير." : "Admin review does not charge or refund Kashier payments."}</span> : null;
  const actions = (r: PaymentRecord) => (r.method === "kashier" ? !!r.orderId && r.status === "review_required" : r.status === "pending") && <>
    {r.status !== "approved" && <Button variant="outline" size="sm" disabled={cardBusy || reviewShare.isPending || reviewRent.isPending || reviewSub.isPending} onClick={() => void handleApproveReject(r, true)}><CheckCircle2 className="me-1 h-3 w-3" />{t("super_admin_fee_approve")}</Button>}
    {r.status !== "rejected" && <Button variant="outline" size="sm" disabled={cardBusy || reviewShare.isPending || reviewRent.isPending || reviewSub.isPending} onClick={() => void handleApproveReject(r, false)}><XCircle className="me-1 h-3 w-3" />{t("super_admin_fee_reject")}</Button>}
  </>;

  return (
    <div className="space-y-4">
      <section aria-label={lang === "ar" ? "مدفوعات تحتاج موافقة" : "Payments needing approval"} className="rounded-2xl border border-primary/35 bg-card p-3 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "مدفوعات تحتاج موافقة" : "Needs approval"}</h2>
            <span className="inline-flex min-w-7 items-center justify-center rounded-full border px-2 py-1 text-xs font-bold leading-none" style={{ color: "#FFFFFF", backgroundColor: "#1D4ED8", borderColor: "#60A5FA" }}>{pendingCount}</span>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={cardBusy} onClick={() => void reloadPayments()}>{lang === "ar" ? "تحديث" : "Refresh"}</Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{lang === "ar" ? "المعاملات التي تحتاج قرارًا من الإدارة تظهر هنا تلقائيًا. معاملات كاشير غير المؤكدة لا يمكن اعتمادها من هذه القائمة." : "Payments needing an admin decision appear here automatically. Unverified Kashier checkouts cannot be approved here."}</p>
        {sharesQuery.isLoading || rentsQuery.isLoading || subscriptionsQuery.isLoading || cardOrdersQuery.isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">{lang === "ar" ? "جارٍ تحميل المدفوعات…" : "Loading payments…"}</p>
        ) : priorityRecords.length === 0 ? (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">{lang === "ar" ? "مفيش مدفوعات محتاجة موافقة حاليًا." : "No payments need approval right now."}</p>
        ) : (
          <div className="space-y-2">
            {priorityRecords.map(r => (
              <article key={r.key} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-foreground">{r.detail}</span>{statusBadge(r.status)}</div>
                  <p className="text-sm text-muted-foreground">{r.label} · {(r.memberId ? memberName(r.memberId) : undefined) ?? r.playerName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.createdAt), "MMM d, yyyy · h:mm a", { locale })}{r.method && <> · {r.method}</>}</p>
                  {r.receiptUrl && <Button type="button" variant="ghost" size="sm" disabled={openingReceipt !== null} onClick={() => void handleViewReceipt(r)}><Eye className="me-1 h-4 w-4" />{t("super_admin_fee_view_receipt")}</Button>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <strong className="me-auto text-base text-foreground sm:me-3">{money(r.amount)}</strong>
                  {actions(r)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <button type="button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 rounded text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Receipt className="h-4 w-4 text-primary" />
          {t("super_admin_payments_title")}
          {pendingCount > 0 && <span className="inline-flex min-w-7 items-center justify-center rounded-full border px-2 py-1 text-xs font-bold leading-none" style={{ color: "#FFFFFF", backgroundColor: "#1D4ED8", borderColor: "#60A5FA" }}>{pendingCount}</span>}
          <ChevronDown className={`ms-auto h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent id={contentId} hidden={!expanded} className="space-y-3">
        <div role="tablist" aria-label={lang === "ar" ? "أقسام المدفوعات" : "Payment sections"} className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-1.5">
          <button type="button" role="tab" aria-selected={paymentTab === "approvals"} onClick={() => setPaymentTab("approvals")} className={`min-w-0 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${paymentTab === "approvals" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}>
            {lang === "ar" ? "موافقات المدفوعات" : "Payment approvals"}
          </button>
          <button type="button" role="tab" aria-selected={paymentTab === "kashier"} onClick={() => setPaymentTab("kashier")} className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${paymentTab === "kashier" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}>
            <span>Kashier</span><span className="rounded-full bg-background/20 px-2 py-0.5 text-xs">{cardOrders?.length ?? 0}</span>
          </button>
        </div>
        {paymentTab === "kashier" && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4" aria-label={lang === "ar" ? "سجل عمليات كاشير" : "Kashier order ledger"}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">{lang === "ar" ? "سجل عمليات Kashier" : "Kashier payment orders"}</h3>
              <p className="text-xs text-muted-foreground">{lang === "ar" ? "كل طلبات الدفع، حتى لو الحجز مش ظاهر في قائمة الموافقات. حالة Pending مش دليل على وصول المبلغ." : "All checkout orders, including those without a visible booking. Pending does not prove funds were received."}</p>
            </div>
            <Badge variant="secondary">{cardOrders?.length ?? 0}</Badge>
          </div>
          {cardOrdersQuery.isError ? (
            <p className="text-sm text-destructive">{lang === "ar" ? "تعذر تحميل سجل كاشير. راجع صلاحيات الحساب واتصال قاعدة البيانات." : "Could not load Kashier orders. Check account access and database connectivity."}</p>
          ) : cardOrdersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{lang === "ar" ? "جار تحميل العمليات…" : "Loading orders…"}</p>
          ) : !cardOrders?.length ? (
            <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد طلبات كاشير في السجل المتاح." : "No Kashier orders in the available ledger."}</p>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {visibleKashier.map(order => {
                  const paid = order.status === "paid";
                  const review = order.status === "review_required";
                  return (
                    <details key={order.id} className="group min-w-0 rounded-xl border border-border bg-muted/35 p-3">
                      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-bold text-foreground">{order.amount} {order.currency}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{order.kind} · {new Date(order.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB")}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${paid ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : review ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-sky-400/30 bg-sky-400/10 text-sky-200"}`}>
                            {paid ? (lang === "ar" ? "مدفوع" : "Paid") : review ? (lang === "ar" ? "يحتاج مراجعة" : "Review") : (lang === "ar" ? "بانتظار التحقق" : "Pending")}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-medium text-primary group-open:hidden">{lang === "ar" ? "عرض التفاصيل +" : "View details +"}</p>
                      </summary>
                      <dl className="mt-3 grid min-w-0 gap-2 border-t border-border pt-3 text-xs">
                        <div><dt className="text-muted-foreground">{lang === "ar" ? "رقم العملية" : "Transaction"}</dt><dd className="mt-1 break-all font-mono text-foreground">{order.transaction_id ?? "—"}</dd></div>
                        <div><dt className="text-muted-foreground">{lang === "ar" ? "رقم الطلب" : "Order ID"}</dt><dd className="mt-1 break-all font-mono text-foreground">{order.id}</dd></div>
                        <div><dt className="text-muted-foreground">{lang === "ar" ? "التاريخ" : "Date"}</dt><dd className="mt-1 text-foreground">{new Date(order.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")}</dd></div>
                      </dl>
                    </details>
                  );
                })}
              </div>
              <div className="hidden max-h-[380px] overflow-auto rounded-lg border border-border md:block">
                <table className="w-full min-w-[760px] text-start text-xs">
                  <thead className="sticky top-0 bg-muted text-muted-foreground">
                    <tr>{(lang === "ar" ? ["التاريخ", "النوع", "المبلغ", "حالة الطلب", "رقم العملية", "رقم الطلب"] : ["Date", "Kind", "Amount", "Order status", "Transaction", "Order ID"]).map(label => <th key={label} className="px-3 py-3 text-start font-semibold">{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {visibleKashier.map(order => (
                      <tr key={order.id} className="border-t border-border hover:bg-muted/40">
                        <td className="whitespace-nowrap px-3 py-3">{new Date(order.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")}</td>
                        <td className="px-3 py-3">{order.kind}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold">{order.amount} {order.currency}</td>
                        <td className="px-3 py-3"><span className={order.status === "paid" ? "text-emerald-300" : order.status === "review_required" ? "text-amber-300" : "text-sky-200"}>{order.status === "paid" ? (lang === "ar" ? "مدفوع ومؤكد" : "Paid") : order.status === "review_required" ? (lang === "ar" ? "دفع مؤكد — مراجعة" : "Paid — review") : (lang === "ar" ? "بانتظار التأكيد" : "Pending verification")}</span></td>
                        <td className="font-mono px-3 py-3">{order.transaction_id ?? "—"}</td>
                        <td className="font-mono px-3 py-3">{order.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination(currentKashierPage, kashierPageCount, sortedKashier.length, setKashierPage)}
            </>
          )}
        </section>
        )}

        {paymentTab === "approvals" && (<>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex min-h-9 h-auto max-w-full flex-wrap items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground">
            {(["all", "share", "rent", "subscription"] as TypeFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setTypeFilter(f); setApprovalPage(1); }}
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
            onValueChange={(v) => { setStatusFilter(v as "all" | PayStatus); setApprovalPage(1); }}
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
            {visibleApprovals.map(r => (
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
                {visibleApprovals.map((r) => {
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
        {pagination(currentApprovalPage, approvalPageCount, sortedFiltered.length, setApprovalPage)}
        </>)}
      </CardContent>
      <Dialog open={receiptPreview !== null} onOpenChange={open => { if (!open) { ++receiptRequest.current; setReceiptPreview(null); setOpeningReceipt(null); } }}>
        <DialogContent className="flex max-h-[90dvh] min-w-0 flex-col overflow-x-hidden rounded-2xl sm:max-w-3xl">
          <DialogTitle className="pe-6">{t("super_admin_fee_view_receipt")}</DialogTitle>
          <DialogDescription>{lang === "ar" ? "راجع الإيصال قبل اعتماد الدفع." : "Review the receipt before approving payment."}</DialogDescription>
          <div className="min-h-40 min-w-0 overflow-auto rounded-xl border bg-muted/30">
            {receiptError ? <p role="alert" className="p-5 text-sm text-error-ink">{t("super_admin_payments_receipt_fail")}</p> : !receiptPreview?.url ? <p role="status" className="p-5 text-sm text-muted-foreground">{lang === "ar" ? "جاري تحميل الإيصال…" : "Loading receipt…"}</p> : /\.pdf$/i.test(receiptPreview.path) ? <iframe src={receiptPreview.url} title={t("super_admin_fee_view_receipt")} className="h-[55dvh] w-full border-0" /> : (
              // Receipt files use signed URLs from private storage.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receiptPreview.url} alt={lang === "ar" ? "إيصال الدفع" : "Payment receipt"} className="mx-auto max-h-[60dvh] max-w-full object-contain" onError={() => setReceiptError(true)} />
            )}
          </div>
          {receiptPreview?.url && <Button variant="outline" asChild><a href={receiptPreview.url} target="_blank" rel="noopener noreferrer">{lang === "ar" ? "افتح الإيصال بحجمه الكامل" : "Open full-size receipt"}</a></Button>}
        </DialogContent>
      </Dialog>
    </Card>
    </div>
  );
}

function PaymentPurpose({ record, language }: { record: PaymentRecord; language: string }) {
  const ar = language === "ar";
  const money = (amount: number) => formatMoneyShort(amount, language as "en" | "ar");
  return <div className="mt-2 min-w-0 space-y-2 text-xs">
    <p className="whitespace-normal break-words text-sm font-semibold leading-relaxed">{record.detail}</p>
    {!!record.guests?.length && <p className="text-xs font-medium text-secondary">{1 + record.guests.length} {ar ? "لاعبين في دفعة واحدة" : "players in one payment"} · {record.guests.length} {ar ? "ضيوف" : "guests"}</p>}
    <details className="group/purpose rounded-xl border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2.5 font-semibold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">{ar ? "تفاصيل الدفع" : "Payment details"}<ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open/purpose:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary>
      <div className="space-y-4 border-t p-3 text-start">
        <section className="space-y-2">
          <h4 className="text-xs font-bold">{ar ? "تفاصيل الحجز" : "Booking details"}</h4>
          <dl className="grid min-w-0 gap-2 sm:grid-cols-2">{record.context.map(field => <div key={field.label} className="min-w-0 rounded-lg bg-card p-2.5">
            <dt className="text-[11px] text-muted-foreground">{field.label}</dt><dd className="mt-1 min-w-0 whitespace-normal break-words text-xs font-medium leading-relaxed">{field.value}</dd>
          </div>)}</dl>
        </section>
        {record.payerShare != null && <section className="space-y-2">
          <h4 className="text-xs font-bold">{ar ? "صاحب الدفع والضيوف" : "Payer & guests"}</h4>
          <ul className="space-y-2">
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-2.5"><span className="min-w-0 break-words font-medium">{record.payerName}<span className="ms-1.5 text-[11px] text-muted-foreground">({ar ? "صاحب الدفع" : "Payer"})</span></span><strong className="whitespace-nowrap">{money(record.payerShare)}</strong></li>
            {record.guests?.map((guest, index) => <li key={guest.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-2.5"><span className="min-w-0 break-words font-medium">{guest.player_name}<span className="ms-1.5 text-[11px] text-muted-foreground">({ar ? "ضيف" : "Guest"} {index + 1})</span></span><strong className="whitespace-nowrap">{money(Number(guest.share_amount ?? 0))}</strong></li>)}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent px-3 py-2.5 text-accent-foreground"><span className="font-semibold">{ar ? "إجمالي الدفعة" : "Payment total"}</span><strong className="text-sm">{money(record.amount)}</strong></div>
        </section>}
        <div className="border-t pt-2"><p className="text-[11px] text-muted-foreground">{ar ? "مرجع الدفع" : "Payment reference"}</p><p dir="ltr" className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{record.key.slice(record.key.indexOf(":") + 1)}</p></div>
      </div>
    </details>
  </div>;
}
