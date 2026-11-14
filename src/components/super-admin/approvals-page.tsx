"use client";
import Link from "next/link";

import { COURT_REVIEW_FIELDS, type CourtReviewField } from "@/lib/court-review";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CourtPayouts } from "@/components/playgrounds/court-payouts";
import type { Venue } from "@/lib/types";
import { PaymentApprovals } from "./payment-approvals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { createClient } from "@/lib/supabase/client";
import { useAllAcademies, usePlaygroundOwnerApprovals } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { OwnerApprovals } from "./owner-approvals";

export function ApprovalsPage() {
  const { t, lang } = useI18n();
  const cache = useQueryClient();
  const weekdays = lang === "ar"
    ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const [section, setSection] = useState<"payments" | "playgrounds" | "owners" | "payouts">("payments");
  const [rejecting, setRejecting] = useState<Venue | null>(null);
  const [missingFields, setMissingFields] = useState<CourtReviewField[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const { data: academies } = useAllAcademies();
  const { data: ownerApplications } = usePlaygroundOwnerApprovals();
  const { data: venues, isLoading, error, refetch } = useQuery({
    queryKey: ["venue-approvals"],
    queryFn: async () => {
      const { data, error } = await createClient().rpc("court_catalog", {p_manage:true});
      if (error) throw error;
      return ((data??[]) as Venue[]).filter(v=>v.approval_status==="pending");
    },
  });
  const review = useMutation({
    mutationFn: async ({ id, approve, fields = [], note = "" }: { id: string; approve: boolean; fields?: CourtReviewField[]; note?: string }) => {
      const { error } = await createClient().rpc("review_court_submission", { p_venue_id: id, p_approve: approve, p_missing_fields: fields, p_note: note });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("venue_review_saved"));
      setRejecting(null); setMissingFields([]); setReviewNote("");
      for (const queryKey of [["venue-approvals"], ["venues"], ["playgrounds"], ["platform-records"]]) {
        cache.invalidateQueries({ queryKey });
      }
    },
    onError: error => toast.error(errorMessage(error, t("common_error"))),
  });
  return <div className="space-y-6">
    <PageHeader title={t("nav_approvals")} subtitle={t("approvals_description")} />
    <div role="group" aria-label={lang === "ar" ? "أقسام الموافقات" : "Approval sections"} className="flex max-w-full flex-wrap gap-2">
      <Button className="min-h-11" variant="outline" asChild><Link href="/admin/shop?tab=orders">{lang === "ar" ? "طلبات المتجر" : "Shop orders"}</Link></Button>
      <Button className="min-h-11" variant={section === "payments" ? "default" : "outline"} onClick={() => setSection("payments")}>{t("approvals_payments")}</Button>
      <Button className="min-h-11" variant={section === "playgrounds" ? "default" : "outline"} onClick={() => setSection("playgrounds")}>{t("nav_playgrounds")} {venues && <Badge variant="secondary" className="ms-2">{venues.length}</Badge>}</Button>
      <Button className="min-h-11" variant={section === "owners" ? "default" : "outline"} onClick={() => setSection("owners")}>{t("approvals_owners")} {ownerApplications && <Badge variant="secondary" className="ms-2">{ownerApplications.length}</Badge>}</Button>
      <Button className="min-h-11" variant={section === "payouts" ? "secondary" : "outline"} onClick={()=>setSection("payouts")}>{lang === "ar" ? "مستحقات الملاعب" : "Court payouts"}</Button>
    </div>
    {section === "payouts" ? <CourtPayouts admin /> : section === "owners" ? (
      <OwnerApprovals />
    ) : section === "payments" ? <PaymentApprovals /> : <div className="space-y-4">
      <Button variant="outline" onClick={() => refetch()}>{t("sa_records_refresh")}</Button>
      {isLoading && <p>{t("common_loading")}</p>}
      {error && <p role="alert" className="text-destructive">{errorMessage(error, t("common_error"))}</p>}
      {!isLoading && !error && venues?.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{t("approvals_empty")}</p>}
      {venues?.map(venue => <Card key={venue.id}>
        <CardHeader><CardTitle className="break-words">{venue.name}</CardTitle><p className="text-sm text-muted-foreground">{academies?.find(a => a.id === venue.academy_id)?.name ?? "—"} · {venue.sport?.name ?? "—"}</p></CardHeader>
        <CardContent className="space-y-4">
          <div><p className="text-xs text-muted-foreground">{lang === "ar" ? "عنوان الملعب" : "Court address"}</p><p className="mt-1 break-words">{venue.address || (lang === "ar" ? "مطلوب — لم يتم تقديمه" : "Required — not provided")}</p></div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">{t("venues_rental_cost")}</dt><dd>{venue.rental_cost ?? "—"} EGP / {venue.rental_hours ?? 1} {lang === "ar" ? "ساعة" : "hour(s)"}</dd></div>
            <div><dt className="text-muted-foreground">{lang === "ar" ? "السعة" : "Capacity"}</dt><dd>{venue.capacity ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">{t("rentals_courts_short")}</dt><dd>{venue.court_count ?? 1}</dd></div>
            <div><dt className="text-muted-foreground">{lang === "ar" ? "الرياضة" : "Sport"}</dt><dd>{venue.sport?.name ?? (lang === "ar" ? "لم يتم تحديدها" : "Not provided")}</dd></div>
            <div><dt className="text-muted-foreground">{t("signup_phone")}</dt><dd dir="ltr" className="text-start">{venue.contact_phone || (lang === "ar" ? "مطلوب — لم يتم تقديمه" : "Required — not provided")}</dd></div>
            {venue.school_name && <div><dt className="text-muted-foreground">{lang === "ar" ? "اسم المدرسة / المنشأة" : "School / facility"}</dt><dd>{venue.school_name}</dd></div>}
          </dl>
          <section className="space-y-2 rounded-lg bg-muted/40 p-3">
            <h3 className="text-sm font-semibold">{lang === "ar" ? "مواعيد العمل" : "Working hours"}</h3>
            {(venue.court_availability?.length || venue.working_hours?.length) ? <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {(venue.court_availability?.length ? venue.court_availability : venue.working_hours ?? []).map((slot, index) => <li key={index} className="flex flex-wrap gap-x-2">
                {"court_number" in slot && <span>{lang === "ar" ? "ملعب" : "Court"} {String(slot.court_number)} ·</span>}
                <span>{weekdays[slot.weekday]}</span><span dir="ltr">{slot.start.slice(0, 5)} – {slot.end.slice(0, 5)}</span>
              </li>)}
            </ul> : <p className="text-sm text-muted-foreground">{lang === "ar" ? "لم يتم تقديم مواعيد عمل" : "No working hours submitted"}</p>}
            {!!venue.unavailable_slots?.length && <div className="text-sm"><p className="font-medium">{lang === "ar" ? "الأوقات غير المتاحة" : "Unavailable times"}</p>{venue.unavailable_slots.map((slot, index) => <p key={index}>{weekdays[slot.weekday]} · <span dir="ltr">{slot.start.slice(0, 5)} – {slot.end.slice(0, 5)}</span></p>)}</div>}
            {!!venue.blocked_dates?.length && <div className="text-sm"><p className="font-medium">{lang === "ar" ? "التواريخ المحجوزة" : "Blocked dates"}</p>{venue.blocked_dates.map((slot, index) => <p key={index}>{slot.date} · {slot.all_day ? (lang === "ar" ? "اليوم بالكامل" : "All day") : `${slot.start ?? ""} – ${slot.end ?? ""}`}</p>)}</div>}
          </section>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">{[[lang === "ar" ? "الدولة" : "Country", venue.country], [lang === "ar" ? "المحافظة" : "Governorate", venue.governorate], [lang === "ar" ? "المدينة / المنطقة" : "City / area", venue.area]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd>{value || (lang === "ar" ? "مطلوب — لم يتم تقديمه" : "Required — not provided")}</dd></div>)}</dl>
          {!venue.location_link && <p className="text-sm text-destructive">{lang === "ar" ? "رابط الخريطة مطلوب — لم يتم تقديمه" : "Map link required — not provided"}</p>}
          {venue.location_link && /^https?:\/\//i.test(venue.location_link) && <a className="text-sm text-primary underline" target="_blank" rel="noopener noreferrer" href={venue.location_link}>{lang === "ar" ? "افتح الموقع على الخريطة" : "View location"}</a>}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{lang === "ar" ? "صور الملعب" : "Court photos"}</h3>
            {venue.cover_url || venue.photos?.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from(new Set<string>([venue.cover_url, ...(Array.isArray(venue.photos) ? venue.photos : [])].filter((url): url is string => !!url))).map((url, index) => <button key={url} type="button" className="overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={() => setPhoto(url)} aria-label={`${lang === "ar" ? "تكبير صورة الملعب" : "Expand court photo"} ${index + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${venue.name} — ${index + 1}`} className="aspect-[4/3] w-full object-cover transition-transform hover:scale-105" />
            </button>)}</div> : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">{lang === "ar" ? "لم يتم رفع صور لهذا الملعب" : "No photos have been uploaded for this court"}</p>}
          </section>
          <div className="flex gap-2"><Button disabled={review.isPending} onClick={() => review.mutate({ id: venue.id, approve: true })}>{t("approvals_approve")}</Button><Button variant="destructive" disabled={review.isPending} onClick={() => { setRejecting(venue); setMissingFields([]); setReviewNote(""); }}>{t("approvals_reject")}</Button></div>
        </CardContent>
      </Card>)}
    </div>}
    <Dialog open={!!rejecting} onOpenChange={open => !open && !review.isPending && setRejecting(null)}><DialogContent><DialogHeader>
      <DialogTitle>{lang === "ar" ? "طلب استكمال معلومات الملعب" : "Request missing court information"}</DialogTitle>
    </DialogHeader>
      <p className="text-sm text-muted-foreground">{lang === "ar" ? "حدد المعلومات المطلوب استكمالها. سيُطلب من صاحب الملعب تعديل هذه المعلومات فقط ثم إعادة الإرسال." : "Select the information to complete. The court manager will be asked to update only these details and resubmit."}</p>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" disabled={review.isPending} className="w-full justify-between">{lang === "ar" ? "المعلومات المطلوبة" : "Missing information"} ({missingFields.length}) ▾</Button></DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-80 w-72 overflow-y-auto">{(Object.keys(COURT_REVIEW_FIELDS) as CourtReviewField[]).map(field => <DropdownMenuCheckboxItem key={field} checked={missingFields.includes(field)} onSelect={event => event.preventDefault()} onCheckedChange={checked => setMissingFields(current => checked ? [...current, field] : current.filter(value => value !== field))}>{COURT_REVIEW_FIELDS[field][lang === "ar" ? "ar" : "en"]}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
      </DropdownMenu>
      <ul className="list-inside list-disc text-sm">{missingFields.map(field => <li key={field}>{COURT_REVIEW_FIELDS[field][lang === "ar" ? "ar" : "en"]}</li>)}</ul>
      <label className="space-y-2 text-sm">{lang === "ar" ? "توضيح إضافي (اختياري)" : "Additional instructions (optional)"}<Textarea maxLength={2000} disabled={review.isPending} value={reviewNote} onChange={event => setReviewNote(event.target.value)} /></label>
      <Button variant="destructive" disabled={review.isPending || missingFields.length === 0} onClick={() => rejecting && review.mutate({ id: rejecting.id, approve: false, fields: missingFields, note: reviewNote })}>{lang === "ar" ? "رفض وإرسال طلب الاستكمال" : "Reject and request corrections"}</Button>
    </DialogContent></Dialog>
    <Dialog open={!!photo} onOpenChange={open => !open && setPhoto(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{t("nav_playgrounds")}</DialogTitle></DialogHeader>{photo &&
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={t("nav_playgrounds")} className="max-h-[75vh] w-full object-contain" />}</DialogContent></Dialog>
  </div>;
}
