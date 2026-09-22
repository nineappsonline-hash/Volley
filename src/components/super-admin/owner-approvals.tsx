"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { usePlaygroundOwnerApprovals, useReviewPlaygroundOwner } from "@/lib/queries";

export function OwnerApprovals() {
  const { t } = useI18n();
  const { data: owners, isLoading, error } = usePlaygroundOwnerApprovals();
  const review = useReviewPlaygroundOwner();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const act = async (id: string, approve: boolean) => {
    try {
      await review.mutateAsync({ ownerId: id, approve, note: notes[id] });
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
      {owners.map((owner) => (
        <Card key={owner.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{owner.profiles?.name ?? owner.business_name ?? "—"}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {owner.business_name ?? "—"}
                  {owner.business_name && " · "}
                  {[owner.country, owner.governorate, owner.area].filter(Boolean).join(", ") || "—"}
                </p>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">{t("login_email")}</dt>
                <dd className="break-all">{owner.profiles?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("signup_phone")}</dt>
                <dd dir="ltr">{owner.profiles?.phone ?? owner.phone ?? "—"}</dd>
              </div>
            </dl>
            <Textarea
              dir="auto"
              value={notes[owner.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [owner.id]: e.target.value }))}
              placeholder={t("owner_review_note_placeholder")}
              className="max-h-28"
            />
            <div className="flex gap-2">
              <Button disabled={review.isPending} onClick={() => act(owner.id, true)}>
                {t("approvals_approve")}
              </Button>
              <Button variant="destructive" disabled={review.isPending} onClick={() => act(owner.id, false)}>
                {t("approvals_reject")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}