"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
  useCoachInvitations,
  useCoaches,
  useInviteCoach,
  useProfiles,
} from "@/lib/queries";

export function InviteCoachDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { data: members, isLoading } = useProfiles();
  const { data: coaches } = useCoaches();
  const { data: invitations } = useCoachInvitations();
  const invite = useInviteCoach();

  const [search, setSearch] = useState("");

  const coachMemberIds = useMemo(
    () => new Set((coaches ?? []).map((c) => c.profile_id).filter(Boolean)),
    [coaches]
  );

  const pendingMemberIds = useMemo(
    () =>
      new Set(
        (invitations ?? [])
          .filter((i) => i.status === "pending")
          .map((i) => i.member_id)
      ),
    [invitations]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (members ?? []).filter((m) => {
      if (m.role !== "member") return false;
      if (q === "") return false;
      const haystack = `${m.username ?? ""} ${m.phone ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [members, search]);

  const handleInvite = async (memberId: string) => {
    try {
      await invite.mutateAsync(memberId);
      toast.success(t("coaches_invite_sent"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("coaches_invite")}</DialogTitle>
          <DialogDescription>{t("coaches_invite_hint")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("coaches_invite_search_placeholder")}
            className="ps-9"
            dir="auto"
          />
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              message={search.trim() ? t("coaches_invite_empty") : t("coaches_invite_hint")}
              icon={UserRoundPlus}
            />
          ) : (
            filtered.map((m) => {
              const isCoach = coachMemberIds.has(m.id);
              const isPending = pendingMemberIds.has(m.id);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                >
                  <ProfileAvatar
                    name={m.name}
                    url={m.avatar_url}
                    avatarId={m.avatar_id}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.username}
                      {m.phone ? ` · ${m.phone}` : ""}
                    </p>
                  </div>
                  {isCoach ? (
                    <Badge variant="outline">{t("coaches_invite_already_coach")}</Badge>
                  ) : isPending ? (
                    <Badge variant="outline">{t("coaches_invite_pending")}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      disabled={invite.isPending}
                      onClick={() => handleInvite(m.id)}
                    >
                      {invite.isPending ? t("common_saving") : t("coaches_invite")}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}