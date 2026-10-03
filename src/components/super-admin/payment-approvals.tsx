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
import { formatMoneyShort } from "@/lib/constants";
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
  const { data: members } = useCommunityMembers();
  const { data: shares } = useAllGamePayments();
  const { data: rents } = useAllRentPayments();
  const { data: subscriptions } = useAllSubscriptions();
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

    for (const p of shares ?? []) {
      out.push({
        key: `share:${p.id}`,
        kind: "share",
        memberId: p.member_id,
        playerName: p.player_name,
        label: t("super_admin_payments_for_share"),
        detail: [p.game?.title, p.game?.sport].filter(Boolean).join(" · "),
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
        detail: r.game?.title ?? "",
        amount: r.amount,
        method: r.pay_method,
        createdAt: r.created_at,
        receiptUrl: r.pay_receipt_url,
        bucket: "game-fee-receipts",
        status: r.pay_status as PayStatus,
      });
    }

    for (const s of subscriptions ?? []) {
      out.push({
        key: `sub:${s.id}`,
        kind: "subscription",
        memberId: s.user_id,
        label: t(
          s.kind === "academy"
            ? "super_admin_payments_for_sub_academy"
            : "super_admin_payments_for_sub_member",
        ),
        detail: `${t(`plans_tier_${s.plan}` as any)} · ${t(`checkout_cycle_${s.billing_cycle}` as any)}`,
        amount: s.amount,
        method: s.method,
        createdAt: s.created_at,
        receiptUrl: s.receipt_url,
        bucket: "subscription-receipts",
        status: s.receipt_status === "verified" ? "approved" : (s.receipt_status as PayStatus),
      });
    }

    return out;
  }, [shares, rents, subscriptions, t]);

  const pendingCount = records.filter((r) => r.status === "pending").length;

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
    } catch {
      toast.error(t("common_error"));
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
                {r.detail && <p className="break-words text-sm text-muted-foreground">{r.detail}</p>}
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="min-w-0 break-words">{(r.memberId ? memberName(r.memberId) : undefined) ?? r.playerName ?? "—"}</span>
                  <strong>{money(r.amount)}</strong>
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(r.createdAt), "MMM d, yyyy · h:mm a", { locale })}{r.method && <> · {t(`game_fee_method_${r.method}` as any)}</>}</p>
                <div className="flex flex-wrap gap-2">
                  {r.receiptUrl && <Button variant="outline" className="h-auto min-h-11 whitespace-normal" disabled={openingReceipt !== null} onClick={() => handleViewReceipt(r)}><Eye className="me-1 h-4 w-4 shrink-0" />{t("super_admin_fee_view_receipt")}</Button>}
                  {r.status === "pending" && <>
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
                  <TableHead className="hidden sm:table-cell">{t("community_organizer")}</TableHead>
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
                      <TableCell>
                        <p className="truncate font-medium">{r.label}</p>
                        {r.detail && (
                          <p className="truncate text-xs text-muted-foreground">{r.detail}</p>
                        )}
                        {r.method && (
                          <p className="text-xs text-muted-foreground lg:hidden">
                            {t(`game_fee_method_${r.method}` as any)}
                          </p>
                        )}
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
                          {r.status === "pending" && (
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
      </CardContent>
    </Card>
  );
}