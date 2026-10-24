"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LocationFields } from "@/components/shared/location-fields";
import { CourtAvailabilityEditor } from "./court-availability-editor";
import { COURT_REVIEW_FIELDS, courtReviewFields } from "@/lib/court-review";
import { workingHoursFromCourtAvailability } from "@/lib/venue-slots";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import type { Venue } from "@/lib/types";

export function needsCourtCorrections(venue: Venue) {
  return venue.approval_status === "rejected" && courtReviewFields(venue.review_missing_fields).length > 0;
}

export function CourtCorrectionRequest({ venue }: { venue: Venue }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const locale = lang === "ar" ? "ar" : "en";
  if (!needsCourtCorrections(venue)) return null;
  return <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
    <p className="font-semibold">{locale === "ar" ? "المعلومات المطلوب استكمالها" : "Information needed for approval"}</p>
    <ul className="list-inside list-disc">{courtReviewFields(venue.review_missing_fields).map(field => <li key={field}>{COURT_REVIEW_FIELDS[field][locale]}</li>)}</ul>
    {venue.review_note && <p className="whitespace-pre-wrap break-words">{venue.review_note}</p>}
    <Button type="button" size="sm" onClick={() => setOpen(true)}>{locale === "ar" ? "استكمال المعلومات وإعادة الإرسال" : "Complete details and resubmit"}</Button>
    {open && <CourtCorrectionsDialog venue={venue} open={open} onOpenChange={setOpen} />}
  </div>;
}

export function CourtCorrectionsDialog({ venue, open, onOpenChange }: { venue: Venue; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const locale = ar ? "ar" : "en";
  const fields = courtReviewFields(venue.review_missing_fields);
  const [draft, setDraft] = useState<Venue>({ ...venue, photos: venue.photos ?? [] });
  const [uploading, setUploading] = useState(false);
  const cache = useQueryClient();
  const { data: sports } = useQuery({ queryKey: ["court-sports"], queryFn: async () => {
    const { data, error } = await createClient().rpc("court_sports"); if (error) throw error;
    return data as { id: string; name: string }[];
  }, enabled: fields.includes("sport") });
  const patch = (value: Partial<Venue>) => setDraft(current => ({ ...current, ...value }));
  const save = useMutation({ mutationFn: async () => {
    const columns = fields.flatMap(field => [...COURT_REVIEW_FIELDS[field].columns]);
    const details = Object.fromEntries(columns.map(column => [column, draft[column as keyof Venue]]));
    const { error } = await createClient().rpc("resubmit_court_corrections", { p_venue_id: venue.id, p_details: details });
    if (error) throw error;
  }, onSuccess: () => {
    for (const key of ["venues", "playgrounds", "venue-approvals", "platform-records"]) void cache.invalidateQueries({ queryKey: [key] });
    void cache.invalidateQueries({ queryKey: ["playground-owner", "venues"] });
    toast.success(ar ? "تم إرسال التعديلات للمراجعة" : "Corrections submitted for review"); onOpenChange(false);
  }, onError: error => toast.error(errorMessage(error, t("common_error"))) });
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (Array.from(files).some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024)) {
      toast.error(ar ? "اختر صور JPG أو PNG أو WebP بحجم أقل من 10 ميجابايت" : "Choose JPG, PNG or WebP images under 10 MB"); return;
    }
    setUploading(true);
    try {
      const client = createClient(); const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error(ar ? "يرجى تسجيل الدخول" : "Please sign in");
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await client.storage.from("venue-photos").upload(path, file, { contentType: file.type });
        if (error) throw error;
        urls.push(client.storage.from("venue-photos").getPublicUrl(path).data.publicUrl);
      }
      setDraft(current => ({ ...current, photos: [...current.photos, ...urls] }));
    } catch (error) { toast.error(errorMessage(error, t("common_error"))); }
    finally { setUploading(false); }
  };
  const textField = (key: "name" | "address" | "contact_phone" | "location_link", label: string, type = "text") => <div className="space-y-1"><Label htmlFor={`correction-${key}`}>{label}</Label><Input id={`correction-${key}`} type={type} required value={draft[key] ?? ""} onChange={event => patch({ [key]: event.target.value })} /></div>;
  const numberField = (key: "rental_cost" | "rental_hours" | "court_count" | "capacity", label: string, min: number, step = "1") => <div className="space-y-1"><Label htmlFor={`correction-${key}`}>{label}</Label><Input id={`correction-${key}`} required type="number" min={min} step={step} value={draft[key] ?? ""} onChange={event => patch({ [key]: event.target.value === "" ? null : Number(event.target.value) })} /></div>;
  return <Dialog open={open} onOpenChange={value => !save.isPending && !uploading && onOpenChange(value)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader>
    <DialogTitle>{ar ? "استكمال معلومات الملعب" : "Complete court information"} · {venue.name}</DialogTitle>
    <DialogDescription>{ar ? "أضف المعلومات التي طلبها المشرف فقط. سيتم الاحتفاظ بباقي بيانات الملعب." : "Complete only the information requested by the reviewer. Your other court details are saved."}</DialogDescription>
  </DialogHeader><form className="space-y-5" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
    {venue.review_note && <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{venue.review_note}</p>}
    <fieldset disabled={save.isPending || uploading} className="space-y-5">
      {fields.map(field => <section key={field} className="space-y-3"><h3 className="font-semibold">{COURT_REVIEW_FIELDS[field][locale]}</h3>
        {field === "name" && textField("name", COURT_REVIEW_FIELDS.name[locale])}
        {field === "address" && textField("address", COURT_REVIEW_FIELDS.address[locale])}
        {field === "phone" && textField("contact_phone", COURT_REVIEW_FIELDS.phone[locale], "tel")}
        {field === "directions" && textField("location_link", COURT_REVIEW_FIELDS.directions[locale], "url")}
        {field === "capacity" && numberField("capacity", COURT_REVIEW_FIELDS.capacity[locale], 1)}
        {field === "courts" && numberField("court_count", COURT_REVIEW_FIELDS.courts[locale], 1)}
        {field === "price" && <div className="grid gap-3 sm:grid-cols-2">{numberField("rental_cost", ar ? "سعر الإيجار (جنيه)" : "Rental price (EGP)", 0, "0.01")}{numberField("rental_hours", ar ? "مدة الإيجار بالساعات" : "Rental duration (hours)", 0.5, "0.5")}</div>}
        {field === "sport" && <select required aria-label={COURT_REVIEW_FIELDS.sport[locale]} className="h-10 w-full rounded-md border bg-background px-3" value={draft.sport_id ?? ""} onChange={event => patch({ sport_id: event.target.value || null })}><option value="">{ar ? "اختر الرياضة" : "Choose sport"}</option>{draft.sport_id && !sports?.some(sport => sport.id === draft.sport_id) && <option value={draft.sport_id}>{venue.sport?.name ?? (ar ? "الرياضة الحالية" : "Current sport")}</option>}{sports?.map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select>}
        {field === "location" && <LocationFields country={draft.country ?? ""} governorate={draft.governorate ?? ""} city={draft.area ?? ""} onCountryChange={country => patch({ country, governorate: "", area: "" })} onGovernorateChange={governorate => patch({ governorate, area: "" })} onCityChange={area => patch({ area })} />}
        {field === "hours" && <CourtAvailabilityEditor value={draft.court_availability ?? []} courtCount={draft.court_count ?? 1} onChange={court_availability => patch({ court_availability, working_hours: workingHoursFromCourtAvailability(court_availability) })} />}
        {field === "photos" && <><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{draft.photos.map(url => <div key={url} className="space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={venue.name} className="aspect-[4/3] w-full rounded-md object-cover" /><Button type="button" variant="outline" size="sm" onClick={() => patch({ photos: draft.photos.filter(photo => photo !== url), ...(draft.cover_url === url ? { cover_url: null } : {}) })}>{t("common_delete")}</Button>
        </div>)}</div><Label htmlFor="correction-photos">{ar ? "إضافة صور الملعب" : "Add court photos"}</Label><Input id="correction-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { void upload(event.target.files); event.target.value = ""; }} /><p className="text-xs text-muted-foreground">JPG / PNG / WebP · 10 MB</p></>}
      </section>)}
    </fieldset>
    <Button type="submit" disabled={save.isPending || uploading || fields.length === 0} className="w-full">{save.isPending || uploading ? t("common_loading") : ar ? "إرسال التعديلات للمراجعة" : "Submit corrections for review"}</Button>
  </form></DialogContent></Dialog>;
}
