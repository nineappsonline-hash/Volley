"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CalendarX, LandPlot, Pencil, Plus, ShieldCheck, TrendingUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CourtCorrectionRequest, needsCourtCorrections } from "./court-corrections";
import { PlaygroundFormDialog } from "@/components/playgrounds/playground-form-dialog";
import { CourtPayouts } from "./court-payouts";
import { AvailabilityDialog } from "@/components/playgrounds/availability-dialog";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import {
  useDeleteVenue,
  useOwnerApplication,
  useOwnerVenues,
  useResubmitPlaygroundOwner,
  useVenueRentals,
} from "@/lib/queries";
import type { Venue, VenueRental } from "@/lib/types";

export function OwnerDashboard() {
  const { t, lang } = useI18n();
  const { data: venues, isLoading } = useOwnerVenues();
  const { data: application } = useOwnerApplication();
  const { data: rentals, isLoading: rentalsLoading } = useVenueRentals();
  const remove = useDeleteVenue();
  const resubmit = useResubmitPlaygroundOwner();

  const [tab, setTab] = useState<"playgrounds" | "schedule" | "revenue">("playgrounds");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [availabilityVenue, setAvailabilityVenue] = useState<Venue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null);
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    (async () => {
      const { data } = await createClient().auth.getUser();
      if (!stale) setOwnerProfileId(data.user?.id ?? null);
    })();
    return () => {
      stale = true;
    };
  }, []);

  const approved = application?.status === "approved";
  const rejected = application?.status === "rejected";

  const upcoming = useMemo(
    () =>
      (rentals ?? [])
        .filter((r) => r.rental_date >= new Date().toISOString().slice(0, 10))
        .sort(
          (a, b) =>
            a.rental_date.localeCompare(b.rental_date) ||
            a.start_time.localeCompare(b.start_time)
        ),
    [rentals]
  );

  const revenue = useMemo(() => {
    let bookings = 0;
    let hours = 0;
    let gross = 0;
    let owner = 0;
    let platform = 0;
    let paid = 0;
    let unpaid = 0;
    const perVenue = new Map<string, { name: string; bookings: number; hours: number; owner: number; platform: number }>();
    for (const r of rentals ?? []) {
      const cost = r.venues?.rental_cost ?? 0;
      const ownerShare = (cost ?? 0) * r.hours;
      const platformShare = Math.max(0, r.price * r.hours - ownerShare);
      bookings += 1;
      hours += r.hours;
      gross += r.price * r.hours;
      owner += ownerShare;
      platform += platformShare;
      if (r.is_paid) paid += r.price * r.hours;
      else unpaid += r.price * r.hours;
      const key = r.venue_id ?? "—";
      const entry = perVenue.get(key) ?? {
        name: r.venues?.name ?? t("venues_unknown"),
        bookings: 0,
        hours: 0,
        owner: 0,
        platform: 0,
      };
      entry.bookings += 1;
      entry.hours += r.hours;
      entry.owner += ownerShare;
      entry.platform += platformShare;
      perVenue.set(key, entry);
    }
    return { bookings, hours, gross, owner, platform, paid, unpaid, perVenue };
  }, [rentals, t]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (v: Venue) => {
    setEditing(v);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(t("venues_deleted"));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const profitBadge = (r: VenueRental) => {
    const cost = r.venues?.rental_cost ?? 0;
    const ownerShare = cost * r.hours;
    const platformShare = Math.max(0, r.price * r.hours - ownerShare);
    return { ownerShare, platformShare };
  };

  return (
    <div className="space-y-6">
      <CourtPayouts />
      <PageHeader title={t("playgrounds_title")} subtitle={t("owner_dashboard_subtitle")}>
        <Button onClick={openNew} disabled={!approved}>
          <Plus className="h-4 w-4" />
          {t("playgrounds_add")}
        </Button>
      </PageHeader>

      {application && !approved && (
        <div
          role="status"
          className={`flex flex-col gap-1 rounded-xl border p-4 text-sm ${
            rejected ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"
          }`}
        >
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            {rejected ? t("owner_rejected_title") : t("owner_pending_title")}
          </p>
          <p className="text-muted-foreground">
            {rejected ? t("owner_rejected_hint") : t("owner_pending_hint")}
          </p>
          {rejected && application.review_note && (
            <p className="rounded-md bg-background/70 p-2 text-xs">
              {t("owner_review_note")}: {application.review_note}
            </p>
          )}
          {rejected && (
            <div className="pt-1">
              <Button
                size="sm"
                disabled={resubmit.isPending}
                onClick={async () => {
                  try {
                    await resubmit.mutateAsync();
                    toast.success(t("owner_resubmit_success"));
                  } catch (err) {
                    toast.error(errorMessage(err, t("common_error")));
                  }
                }}
              >
                {t("owner_resubmit_button")}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "playgrounds" ? "default" : "outline"} onClick={() => setTab("playgrounds")}>
          {t("owner_tab_playgrounds")}
        </Button>
        <Button variant={tab === "schedule" ? "default" : "outline"} onClick={() => setTab("schedule")}>
          {t("owner_tab_schedule")}
        </Button>
        <Button variant={tab === "revenue" ? "default" : "outline"} onClick={() => setTab("revenue")}>
          {t("owner_tab_revenue")}
        </Button>
      </div>

      {tab === "playgrounds" && (
        <div className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !venues || venues.length === 0 ? (
            <EmptyState
              message={t("playgrounds_empty")}
              hint={approved ? t("owner_add_first_hint") : t("owner_pending_hint")}
              icon={LandPlot}
              action={
                <Button onClick={openNew} disabled={!approved}>
                  <Plus className="h-4 w-4" />
                  {t("playgrounds_add")}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {venues.map((v) => (
                <div key={v.id} className="overflow-hidden rounded-xl border">
                  {v.cover_url || (v.photos && v.photos[0]) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.cover_url ?? v.photos[0]}
                      alt={v.name}
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-muted text-muted-foreground">
                      <LandPlot className="h-8 w-8" />
                    </div>
                  )}
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{v.name}</p>
                        {v.address && (
                          <p className="text-xs text-muted-foreground">{v.address}</p>
                        )}
                      </div>
                      <Badge variant="outline">
                        {t(`venue_approval_${v.approval_status ?? "approved"}`)}
                      </Badge>
                    </div>
                    <CourtCorrectionRequest venue={v} />
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {v.rental_cost != null
                          ? `${formatMoney(Number(v.rental_cost), lang)}/h`
                          : "—"}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label={t("common_edit")} onClick={() => openEdit(v)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          aria-label={t("common_delete")}
                          onClick={() => setDeleteTarget(v)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" disabled={needsCourtCorrections(v)} onClick={() => setAvailabilityVenue(v)}>
                      <CalendarX className="h-4 w-4" />
                      {t("owner_availability_button")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "schedule" && (
        <div className="overflow-x-auto rounded-xl border">
          {rentalsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : upcoming.length === 0 ? (
            <EmptyState message={t("owner_schedule_empty")} icon={CalendarDays} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("rentals_date")}</TableHead>
                  <TableHead>{t("rentals_time")}</TableHead>
                  <TableHead>{t("venues_name")}</TableHead>
                  <TableHead>{t("rentals_customer")}</TableHead>
                  <TableHead className="text-end">{t("rentals_hours_short")}</TableHead>
                  <TableHead className="text-end">{t("owner_share")}</TableHead>
                  <TableHead className="text-end">{t("rentals_paid")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.rental_date}</TableCell>
                    <TableCell className="font-mono text-xs">{r.start_time}</TableCell>
                    <TableCell>{r.venues?.name ?? "—"}</TableCell>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell className="text-end">{r.hours}</TableCell>
                    <TableCell className="text-end font-medium">
                      {formatMoney(profitBadge(r).ownerShare, lang)}
                    </TableCell>
                    <TableCell className="text-end">
                      <Badge variant={r.is_paid ? "default" : "outline"}>
                        {r.is_paid ? t("rentals_paid") : t("rentals_unpaid")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {tab === "revenue" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">{t("owner_total_bookings")}</p>
              <p className="mt-1 text-2xl font-extrabold">{revenue.bookings}</p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(revenue.hours, lang)} {t("rentals_hours_short")}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">{t("owner_earnings")}</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">
                {formatMoney(revenue.owner, lang)}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">{t("platform_fee")}</p>
              <p className="mt-1 text-2xl font-extrabold">{formatMoney(revenue.platform, lang)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">{t("rentals_paid_total")}</p>
              <p className="mt-1 text-2xl font-extrabold">{formatMoney(revenue.paid, lang)}</p>
              <p className="text-xs text-muted-foreground">
                {t("rentals_unpaid_total")}: {formatMoney(revenue.unpaid, lang)}
              </p>
            </div>
          </div>

          {revenue.bookings === 0 ? (
            <EmptyState message={t("owner_revenue_empty")} icon={TrendingUp} hint={t("owner_revenue_empty_hint")} />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("venues_name")}</TableHead>
                    <TableHead className="text-end">{t("owner_bookings_col")}</TableHead>
                    <TableHead className="text-end">{t("rentals_hours_short")}</TableHead>
                    <TableHead className="text-end">{t("owner_earnings")}</TableHead>
                    <TableHead className="text-end">{t("platform_fee")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(revenue.perVenue.values()).map((v) => (
                    <TableRow key={v.name}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-end">{v.bookings}</TableCell>
                      <TableCell className="text-end">{v.hours}</TableCell>
                      <TableCell className="text-end font-medium text-primary">
                        {formatMoney(v.owner, lang)}
                      </TableCell>
                      <TableCell className="text-end">{formatMoney(v.platform, lang)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <PlaygroundFormDialog
        key={`${editing?.id ?? "new"}-${dialogOpen ? "open" : "closed"}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        venue={editing}
        ownerProfileId={ownerProfileId} ownerPhone={application?.phone}
      />

      <AvailabilityDialog
        open={!!availabilityVenue}
        onOpenChange={(o) => !o && setAvailabilityVenue(null)}
        venue={availabilityVenue}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("playgrounds_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("playgrounds_delete_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {t("common_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}