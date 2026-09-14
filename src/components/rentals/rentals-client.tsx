"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
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
import { AlertTriangle, CheckCircle2, LandPlot, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { errorMessage, todayInput } from "@/lib/utils";
import {
  useDeleteVenueRental,
  useSaveVenueRental,
  useVenueRentals,
  useVenues,
} from "@/lib/queries";
import type { RentalPaymentMethod, VenueRental } from "@/lib/types";
import {
  dayWorkingHoursLabel,
  findBlockedOverlap,
  formatBlockedSlot,
  isWithinWorkingHours,
  timeSlotsOverlap,
} from "@/lib/venue-slots";

const PAYMENT_METHODS = ["cash", "bank_transfer", "e_wallet"] as const;

export function RentalsClient() {
  const { t, lang } = useI18n();
  const { data: rentals, isLoading } = useVenueRentals();
  const { data: venues } = useVenues();
  const save = useSaveVenueRental();
  const remove = useDeleteVenueRental();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VenueRental | null>(null);
  const [venueId, setVenueId] = useState("none");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [price, setPrice] = useState("");
  const [hours, setHours] = useState("1");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [method, setMethod] = useState<RentalPaymentMethod | "none">("none");
  const [notes, setNotes] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<VenueRental | null>(null);

  const assignedCourt = useMemo(() => {
    if (venueId === "none" || !date || !time) return null;
    const courtCount = (venues ?? []).find((v) => v.id === venueId)?.court_count ?? 1;
    const duration = Number(hours) || 1;
    for (let court = 1; court <= courtCount; court++) {
      const taken = (rentals ?? []).some((r) => {
        if (editing && r.id === editing.id) return false;
        if (r.venue_id !== venueId || r.rental_date !== date) return false;
        if ((r.court_number ?? 1) !== court) return false;
        return timeSlotsOverlap(time, duration, r.start_time, Number(r.hours) || 1);
      });
      if (!taken) return court;
    }
    return null;
  }, [rentals, venues, venueId, date, time, hours, editing]);

  const courtCount = (venues ?? []).find((v) => v.id === venueId)?.court_count ?? 1;
  const courtBooked = venueId !== "none" && !!date && !!time && assignedCourt === null;

  const blockedSlot = (() => {
    if (venueId === "none" || !date || !time) return null;
    const venue = (venues ?? []).find((v) => v.id === venueId);
    if (!venue?.unavailable_slots?.length) return null;
    return findBlockedOverlap(venue.unavailable_slots, date, time, Number(hours) || 1);
  })();

  const workingHours = (venues ?? []).find((v) => v.id === venueId)?.working_hours ?? [];
  const outsideWorkingHours =
    venueId !== "none" &&
    !!date &&
    !!time &&
    workingHours.length > 0 &&
    !isWithinWorkingHours(workingHours, date, time, Number(hours) || 1);
  const workingHoursWarning = outsideWorkingHours
    ? (() => {
        const label = dayWorkingHoursLabel(workingHours, date);
        return label
          ? t("wh_outside").replace("{hours}", label)
          : t("wh_closed_day");
      })()
    : null;

  useEffect(() => {
    if (dialogOpen && !editing) {
      setVenueId("none");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setPrice("");
      setHours("1");
      setDate(todayInput());
      setTime("");
      setIsPaid(false);
      setMethod("none");
      setNotes("");
    }
  }, [dialogOpen, editing]);

  const openEdit = (r: VenueRental) => {
    setEditing(r);
    setVenueId(r.venue_id ?? "none");
    setCustomerName(r.customer_name);
    setCustomerPhone(r.customer_phone ?? "");
    setCustomerEmail(r.customer_email ?? "");
    setPrice(r.price != null ? String(r.price) : "");
    setHours(r.hours != null ? String(r.hours) : "1");
    setDate(r.rental_date);
    setTime(r.start_time);
    setIsPaid(r.is_paid);
    setMethod(r.payment_method ?? "none");
    setNotes(r.notes ?? "");
    setDialogOpen(true);
  };

  const venueName = useMemo(() => {
    const map = new Map((venues ?? []).map((v) => [v.id, v.name]));
    return (id: string | null) => (id && map.get(id)) || "—";
  }, [venues]);

  const rentalAmount = (r: VenueRental) =>
    Number(r.price) * (Number(r.hours) || 1);

  const totals = useMemo(() => {
    const total = (rentals ?? []).reduce((s, r) => s + rentalAmount(r), 0);
    const collected = (rentals ?? []).reduce(
      (s, r) => s + (r.is_paid ? rentalAmount(r) : 0),
      0
    );
    return { total, collected, outstanding: total - collected };
  }, [rentals]);

  const handleSave = async () => {
    if (!customerName.trim() || !date || !time) return;
    if (blockedSlot) {
      toast.error(t("unavail_blocked_msg").replace("{slot}", formatBlockedSlot(blockedSlot, d => t(`avail_day_${d}` as any))));
      return;
    }
    if (outsideWorkingHours) {
      toast.error(workingHoursWarning ?? t("wh_closed_day"));
      return;
    }
    if (courtBooked) {
      toast.error(t("rentals_all_booked").replace("{count}", String(courtCount)));
      return;
    }
    try {
      await save.mutateAsync({
        id: editing?.id,
        venue_id: venueId === "none" ? null : venueId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim() || null,
        price: Number(price) || 0,
        hours: Number(hours) || 1,
        rental_date: date,
        start_time: time,
        is_paid: isPaid,
        payment_method: method === "none" ? null : method,
        notes: notes.trim() || null,
      });
      toast.success(t("rentals_saved"));
      setDialogOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const togglePaid = async (r: VenueRental) => {
    try {
      await save.mutateAsync({
        id: r.id,
        venue_id: r.venue_id,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_email: r.customer_email,
        price: Number(r.price),
        hours: Number(r.hours) || 1,
        rental_date: r.rental_date,
        start_time: r.start_time,
        is_paid: !r.is_paid,
        payment_method: r.payment_method,
        notes: r.notes,
      });
      toast.success(r.is_paid ? t("rentals_mark_unpaid") : t("rentals_mark_paid"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(t("rentals_deleted"));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("rentals_title")} subtitle={t("rentals_subtitle")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/playgrounds">
              <LandPlot className="h-4 w-4" />
              {t("nav_playgrounds")}
            </Link>
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("rentals_add")}
          </Button>
        </div>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("rentals_total"), value: formatMoney(totals.total, lang) },
          { label: t("rentals_paid_total"), value: formatMoney(totals.collected, lang) },
          { label: t("rentals_unpaid_total"), value: formatMoney(totals.outstanding, lang) },
          { label: t("rentals_count"), value: String((rentals ?? []).length) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-lg font-bold" dir="ltr">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !rentals || rentals.length === 0 ? (
        <EmptyState message={t("rentals_empty")} icon={Wallet} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("rentals_venue")}</TableHead>
                <TableHead>{t("rentals_court")}</TableHead>
                <TableHead>{t("rentals_customer")}</TableHead>
                <TableHead>{t("rentals_date")} / {t("rentals_time")}</TableHead>
                <TableHead className="text-end">{t("rentals_amount")}</TableHead>
                <TableHead>{t("rentals_payment_method")}</TableHead>
                <TableHead>{t("members_col_status")}</TableHead>
                <TableHead className="text-end">{t("members_col_actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rentals ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{venueName(r.venue_id)}</TableCell>
                  <TableCell>
                    {r.venue_id ? (
                      <Badge variant="outline">
                        {t("rentals_court_short")} {r.court_number ?? 1}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{r.customer_name}</p>
                    {(r.customer_phone || r.customer_email) && (
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {[r.customer_phone, r.customer_email].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell dir="ltr" className="text-start font-mono text-sm">
                    {r.rental_date} · {r.start_time.slice(0, 5)}
                  </TableCell>
                  <TableCell className="text-end">
                    <p className="font-mono">
                      {formatMoney(rentalAmount(r), lang)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(r.hours) || 1} {t("rentals_hours_short")} ×{" "}
                      {formatMoney(Number(r.price), lang)}
                    </p>
                  </TableCell>
                  <TableCell>
                    {r.payment_method ? (
                      <Badge variant="outline">
                        {t(`rentals_method_${r.payment_method}` as any)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.is_paid ? (
                      <Badge className="bg-positive-600 text-white">
                        {t("rentals_paid")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        {t("rentals_unpaid")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={r.is_paid ? t("rentals_mark_unpaid") : t("rentals_mark_paid")}
                        onClick={() => togglePaid(r)}
                      >
                        <CheckCircle2
                          className={`h-4 w-4 ${
                            r.is_paid ? "text-success-ink" : "text-muted-foreground/50"
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common_edit")}
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("rentals_edit") : t("rentals_add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("rentals_venue")}</Label>
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger aria-label={t("rentals_venue")}>
                  <SelectValue placeholder={t("rentals_venue_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("venue_none")}</SelectItem>
                  {(venues ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      {Number(v.court_count) > 1
                        ? ` (${v.court_count} ${t("rentals_courts_short")})`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("rentals_customer")}</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t("rentals_customer")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("rentals_phone")}</Label>
                <Input
                  dir="ltr"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rentals_email")}</Label>
                <Input
                  dir="ltr"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("rentals_date")}</Label>
                  <Input dir="ltr" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("rentals_time")}</Label>
                  <Input dir="ltr" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("rentals_hours")}</Label>
                  <Input
                    dir="ltr"
                    type="number"
                    min="0"
                    step="0.5"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
              {blockedSlot && (
                <p className="flex items-center gap-1.5 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {t("unavail_inline").replace("{slot}", formatBlockedSlot(blockedSlot, (d) => t(`avail_day_${d}` as any)))}
                </p>
              )}
              {outsideWorkingHours && (
                <p className="flex items-center gap-1.5 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {workingHoursWarning}
                </p>
              )}
              {courtBooked && (
                <p className="flex items-center gap-1.5 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {t("rentals_all_booked").replace("{count}", String(courtCount))}
                </p>
              )}
              {!courtBooked && venueId !== "none" && !!date && !!time && assignedCourt != null && (
                <p className="flex items-center gap-1.5 rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {t("rentals_court_preview").replace("{court}", String(assignedCourt))}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("rentals_price")}</Label>
                  <Input
                    dir="ltr"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <Label className="text-xs text-muted-foreground">
                    {t("rentals_total")}
                  </Label>
                  <p className="font-mono text-lg font-semibold" dir="ltr">
                    {formatMoney((Number(price) || 0) * (Number(hours) || 1), lang)}
                  </p>
                </div>
              </div>
            <div className="space-y-2">
              <Label>{t("rentals_payment_method")}</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as RentalPaymentMethod | "none")}
              >
                <SelectTrigger aria-label={t("rentals_payment_method")}>
                  <SelectValue placeholder={t("rentals_payment_method")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common_none")}</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`rentals_method_${m}` as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isPaid} onCheckedChange={setIsPaid} id="rental-paid" />
              <Label htmlFor="rental-paid" className="cursor-pointer text-sm">
                {isPaid ? t("rentals_paid") : t("rentals_unpaid")}
              </Label>
            </div>
            <div className="space-y-2">
              <Label>{t("rentals_notes")}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("rentals_notes")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common_cancel")}
            </Button>
            <Button
              disabled={!customerName.trim() || !date || !time || !!blockedSlot || outsideWorkingHours || courtBooked || save.isPending}
              onClick={() => handleSave()}
            >
              {save.isPending ? t("common_saving") : t("common_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rentals_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("rentals_delete_confirm")}</AlertDialogDescription>
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