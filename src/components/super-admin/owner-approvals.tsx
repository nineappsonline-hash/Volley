"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ShieldCheck } from "lucide-react";
import { formatMoney } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { usePlaygroundOwnerApprovals, useReviewPlaygroundOwner } from "@/lib/queries";
import type { Venue } from "@/lib/types";

function venuePhotos(venue: Venue): string[] {
  return Array.from(
    new Set<string>(
      [venue.cover_url, ...(Array.isArray(venue.photos) ? venue.photos : [])].filter(
        (url): url is string => !!url
      )
    )
  );
}

export function OwnerApprovals() {
  const { t, lang } = useI18n();
  const weekdays =
    lang === "ar"
      ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const { data: owners, isLoading, error } = usePlaygroundOwnerApprovals();
  const review = useReviewPlaygroundOwner();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<string | null>(null);

  const act = async (id: string, approve: boolean) => {
    const note = notes[id]?.trim() ?? "";
    if (!approve && !note) {
      toast.error(t("owner_refuse_reason_required"));
      return;
    }
    try {
      await review.mutateAsync({ ownerId: id, approve, note: note || undefined });
      toast.success(t("venue_review_saved"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error)
    return <p role="alert" className="text-destructive">{errorMessage(error, t("common_error"))}</p>;

  if (!owners || owners.length === 0)
    return <EmptyState message={t("approvals_owners_empty")} icon={ShieldCheck} />;

  return (
    <div className="space-y-4">
      {owners.map((owner) => {
        const venues = owner.venues ?? [];
        return (
          <Card key={owner.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>{owner.business_name ?? owner.profiles?.name ?? "—"}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {[owner.country, owner.governorate, owner.area].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <Badge variant="outline">{t("venue_approval_pending")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">{t("owner_contact_name")}</dt>
                  <dd>{owner.profiles?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("login_email")}</dt>
                  <dd className="break-all">{owner.profiles?.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("signup_phone")}</dt>
                  <dd dir="ltr">{owner.profiles?.phone ?? owner.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("owner_business_name")}</dt>
                  <dd className="break-all">{owner.business_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("signup_country")}</dt>
                  <dd>{owner.country ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("signup_governorate")} / {t("signup_city")}
                  </dt>
                  <dd>{[owner.governorate, owner.area].filter(Boolean).join(" / ") || "—"}</dd>
                </div>
              </dl>

              <div className="space-y-3">
                <p className="font-semibold">{t("approvals_owner_playgrounds")}</p>
                {venues.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
                    {t("approvals_owner_no_playgrounds")}
                  </p>
                ) : (
                  venues.map((venue) => {
                    const photos = venuePhotos(venue);
                    return (
                      <div key={venue.id} className="space-y-3 rounded-lg border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{venue.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[venue.sport?.name, venue.country, venue.governorate, venue.area, venue.address]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </p>
                          </div>
                          {venue.approval_status && (
                            <Badge variant="outline">
                              {t(`venue_approval_${venue.approval_status}`)}
                            </Badge>
                          )}
                        </div>
                        <dl className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <dt className="text-muted-foreground">{t("venues_rental_cost")}</dt>
                            <dd>
                              {venue.rental_cost != null
                                ? `${formatMoney(Number(venue.rental_cost), lang)} / ${venue.rental_hours ?? 1} ${lang === "ar" ? "ساعة" : "hour(s)"}`
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">{t("venues_court_count")}</dt>
                            <dd>{venue.court_count ?? 1}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">{t("venues_capacity")}</dt>
                            <dd>{venue.capacity ?? "—"}</dd>
                          </div>
                        </dl>
                        {venue.court_availability && venue.court_availability.length > 0 && (
                          <div>
                            <p className="text-muted-foreground">
                              {t("owner_availability_button")}
                            </p>
                            <p className="text-xs">
                              {venue.court_availability
                                .map(
                                  (slot) =>
                                    `${t("rentals_courts_short")} ${slot.court_number} · ${weekdays[slot.weekday] ?? slot.weekday} ${slot.start}–${slot.end}`
                                )
                                .join(" · ")}
                            </p>
                          </div>
                        )}
                        {venue.location_link && /^https?:\/\//i.test(venue.location_link) && (
                          <a
                            className="text-sm text-primary underline"
                            target="_blank"
                            rel="noopener noreferrer"
                            href={venue.location_link}
                          >
                            {t("sa_location_link")}
                          </a>
                        )}
                        {photos.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {photos.map((url) => (
                              <button
                                key={url}
                                type="button"
                                onClick={() => setPhoto(url)}
                                aria-label={t("approvals_expand_photo")}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={venue.name}
                                  className="h-24 w-32 rounded-lg object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-2">
                <p className="font-semibold">{t("owner_refuse_reason")}</p>
                <Textarea
                  dir="auto"
                  value={notes[owner.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [owner.id]: e.target.value }))}
                  placeholder={t("owner_review_note_placeholder")}
                  className="max-h-28"
                />
              </div>
              <div className="flex gap-2">
                <Button disabled={review.isPending} onClick={() => act(owner.id, true)}>
                  {t("approvals_approve")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={review.isPending}
                  onClick={() => act(owner.id, false)}
                >
                  {t("approvals_reject")}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!photo} onOpenChange={(open) => !open && setPhoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("nav_playgrounds")}</DialogTitle>
          </DialogHeader>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={t("nav_playgrounds")} className="max-h-[75vh] w-full object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
