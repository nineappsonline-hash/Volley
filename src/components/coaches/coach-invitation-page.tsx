"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
  useCoachInvitation,
  useRespondCoachInvitation,
} from "@/lib/queries";
import type { CoachInvitationStatus } from "@/lib/types";

export function CoachInvitationPage({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { data: invitation, isLoading } = useCoachInvitation(id);
  const respond = useRespondCoachInvitation();

  const handleRespond = async (accept: boolean) => {
    if (!invitation) return;
    try {
      await respond.mutateAsync({ id: invitation.id, accept });
      toast.success(t(accept ? "coaches_invitation_accepted" : "coaches_invitation_declined"));
      router.push("/coaches");
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("coaches_invitation_title")} />

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !invitation ? (
        <EmptyState message={t("coaches_invitation_not_found")} icon={UserRound} />
      ) : (
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                name={invitation.inviter?.name ?? "?"}
                url={invitation.inviter?.avatar_url}
                avatarId={invitation.inviter?.avatar_id}
                className="h-14 w-14"
              />
              <div>
                <p className="text-lg font-semibold">{invitation.academy?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t("coaches_invitation_from")} {invitation.inviter?.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {t("coaches_invite_hint")}
            </p>

            {invitation.status === "pending" ? (
              <div className="flex items-center gap-2">
                <Button onClick={() => handleRespond(true)} disabled={respond.isPending}>
                  <BadgeCheck className="h-4 w-4" />
                  {t("coaches_invitation_accept")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleRespond(false)}
                  disabled={respond.isPending}
                >
                  <X className="h-4 w-4" />
                  {t("coaches_invitation_decline")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-medium">
                {invitation.status === "accepted" ? (
                  <>
                    <Check className="h-4 w-4 text-primary" />
                    {t("coaches_invitation_accepted")}
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-destructive" />
                    {t("coaches_invitation_declined")}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}