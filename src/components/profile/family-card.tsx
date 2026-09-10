"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Crown, Pencil, Trash2, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { AddChildDialog } from "@/components/profile/add-child-dialog";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useChildren, useRemoveFamilyMember } from "@/lib/queries";
import type { Profile } from "@/lib/types";

export function FamilyCard() {
  const { t } = useI18n();
  const { data: children, isLoading } = useChildren();
  const removeChild = useRemoveFamilyMember();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleRemove = async (child: Profile) => {
    try {
      await removeChild.mutateAsync(child.id);
      toast.success(t("family_removed"));
      setConfirmingId(null);
    } catch (e) {
      console.error("[family] remove failed", e);
      toast.error(errorMessage(e, t("common_error")));
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersRound className="h-4 w-4 text-primary" />
          {t("family_title")}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="h-8 gap-1 px-2 text-xs">
          <Link href="/parent">
            {t("family_overview")}
            <ArrowRight className="ms-1 h-3 w-3 rtl:rotate-180" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t("family_subtitle")}</p>

        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !children || children.length === 0 ? (
          <EmptyState message={t("family_none")} icon={UsersRound} />
        ) : (
          <div className="space-y-2">
            {children.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-3 rounded-lg border p-2.5"
              >
                <ProfileAvatar name={child.name} url={child.avatar_url} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{child.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <Badge
                      variant={child.membership_type === "half" ? "outline" : "default"}
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {child.membership_type === "half"
                        ? t("membership_half")
                        : t("membership_full")}
                    </Badge>
                    {child.member_plan === "premium" && (
                      <Badge className="bg-info/15 px-1.5 py-0 text-info-ink text-[10px]">
                        <Crown className="mr-0.5 h-2.5 w-2.5" />
                        Premium
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 px-2 text-xs"
                  >
                    <Link href={`/profile/children/${child.id}`}>
                      {t("family_view_progress")}
                      <ArrowRight className="ms-1 h-3 w-3 rtl:rotate-180" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={t("family_edit")}
                    onClick={() => {
                      setEditing(child);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {confirmingId === child.id ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleRemove(child)}
                    >
                      {t("family_remove_confirm")}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t("family_remove")}
                      onClick={() => setConfirmingId(child.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          {t("family_add")}
        </Button>
      </CardContent>

      <AddChildDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        child={editing}
      />
    </Card>
  );
}