"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  const [section, setSection] = useState<"payments" | "playgrounds" | "owners">("payments");
  const [photo, setPhoto] = useState<string | null>(null);
  const { data: academies } = useAllAcademies();
  const { data: ownerApplications } = usePlaygroundOwnerApprovals();
  const { data: venues, isLoading, error, refetch } = useQuery({
    queryKey: ["venue-approvals"],
    queryFn: async () => {
      const { data, error } = await createClient().from("venues")
        .select("id, name, academy_id, address, country, governorate, area, rental_cost, rental_hours, capacity, court_count, photos, cover_url, location_link, sport_id, created_at")
        .eq("approval_status", "pending").order("created_at");
      if (error) throw error;
      const { data: labels, error: sportError } = await createClient().rpc("playground_sport_labels");
      if (sportError) throw sportError;
      return (data ?? []).map(v => ({ ...v, sport: (labels ?? []).find((s: { venue_id: string; sport_name: string }) => s.venue_id === v.id)?.sport_name as string | undefined }));
    },
  });
  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await createClient().rpc("review_playground", { p_venue_id: id, p_approve: approve });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("venue_review_saved"));
      for (const queryKey of [["venue-approvals"], ["venues"], ["playgrounds"], ["platform-records"]]) {
        cache.invalidateQueries({ queryKey });
      }
    },
    onError: error => toast.error(errorMessage(error, t("common_error"))),
  });
  return <div className="space-y-6">
    <PageHeader title={t("nav_approvals")} subtitle={t("approvals_description")} />
    <div className="flex flex-wrap gap-2">
      <Button variant={section === "payments" ? "default" : "outline"} onClick={() => setSection("payments")}>{t("approvals_payments")}</Button>
      <Button variant={section === "playgrounds" ? "default" : "outline"} onClick={() => setSection("playgrounds")}>{t("nav_playgrounds")} {venues && <Badge variant="secondary" className="ms-2">{venues.length}</Badge>}</Button>
      <Button variant={section === "owners" ? "default" : "outline"} onClick={() => setSection("owners")}>{t("approvals_owners")} {ownerApplications && <Badge variant="secondary" className="ms-2">{ownerApplications.length}</Badge>}</Button>
    </div>
    {section === "owners" ? (
      <OwnerApprovals />
    ) : section === "payments" ? <PaymentApprovals /> : <div className="space-y-4">
      <Button variant="outline" onClick={() => refetch()}>{t("sa_records_refresh")}</Button>
      {isLoading && <p>{t("common_loading")}</p>}
      {error && <p role="alert" className="text-destructive">{errorMessage(error, t("common_error"))}</p>}
      {!isLoading && !error && venues?.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{t("approvals_empty")}</p>}
      {venues?.map(venue => <Card key={venue.id}>
        <CardHeader><CardTitle>{venue.name}</CardTitle><p className="text-sm text-muted-foreground">{academies?.find(a => a.id === venue.academy_id)?.name ?? "—"} · {venue.sport ?? "—"}</p></CardHeader>
        <CardContent className="space-y-4">
          <p>{[venue.country, venue.governorate, venue.area, venue.address].filter(Boolean).join(" · ")}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">{t("venues_rental_cost")}</dt><dd>{venue.rental_cost ?? "—"} EGP / {venue.rental_hours ?? 1} {lang === "ar" ? "ساعة" : "hour(s)"}</dd></div>
            <div><dt className="text-muted-foreground">{lang === "ar" ? "السعة" : "Capacity"}</dt><dd>{venue.capacity ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">{t("rentals_courts_short")}</dt><dd>{venue.court_count ?? 1}</dd></div>
          </dl>
          {venue.location_link && /^https?:\/\//i.test(venue.location_link) && <a className="text-sm text-primary underline" target="_blank" rel="noopener noreferrer" href={venue.location_link}>{lang === "ar" ? "افتح الموقع على الخريطة" : "View location"}</a>}
          <div className="flex flex-wrap gap-2">{Array.from(new Set<string>([venue.cover_url, ...(Array.isArray(venue.photos) ? venue.photos : [])].filter(Boolean))).map(url => <button key={url} type="button" onClick={() => setPhoto(url)} aria-label={lang === "ar" ? "تكبير الصورة" : "Expand photo"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={venue.name} className="h-24 w-32 rounded-lg object-cover" />
          </button>)}</div>
          <div className="flex gap-2"><Button disabled={review.isPending} onClick={() => review.mutate({ id: venue.id, approve: true })}>{t("approvals_approve")}</Button><Button variant="destructive" disabled={review.isPending} onClick={() => review.mutate({ id: venue.id, approve: false })}>{t("approvals_reject")}</Button></div>
        </CardContent>
      </Card>)}
    </div>}
    <Dialog open={!!photo} onOpenChange={open => !open && setPhoto(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{t("nav_playgrounds")}</DialogTitle></DialogHeader>{photo &&
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={t("nav_playgrounds")} className="max-h-[75vh] w-full object-contain" />}</DialogContent></Dialog>
  </div>;
}
