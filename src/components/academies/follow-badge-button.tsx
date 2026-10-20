"use client";

import { authLink } from "@/lib/auth-redirect";
import { usePathname, useSearchParams } from "next/navigation";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  useAcademyFollowerCount,
  useFollowAcademy,
  useMyAcademyFollows,
  useUnfollowAcademy,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

export function FollowAcademyButton({
  academyId,
  className,
  size = "default",
  showCount = false,
}: {
  academyId: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  showCount?: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const login = authLink("/login", `${path}${params.size ? `?${params}` : ""}`);
  const { t } = useI18n();
  const { data: follows, isLoading: loadingFollows } = useMyAcademyFollows();
  const { data: followerCount } = useAcademyFollowerCount(
    showCount ? academyId : undefined
  );
  const follow = useFollowAcademy();
  const unfollow = useUnfollowAcademy();
  const [authChecked, setAuthChecked] = useState<boolean | null>(null);

  const following = (follows ?? []).some((f) => f.academy_id === academyId);
  const busy = follow.isPending || unfollow.isPending;

  const onClick = async () => {
    if (authChecked === null) {
      const { createClient } = await import("@/lib/supabase/client");
      const {
        data: { user },
      } = await createClient().auth.getUser();
      setAuthChecked(!!user);
      if (!user) {
        router.push(login);
        return;
      }
    } else if (!authChecked) {
      router.push(login);
      return;
    }
    if (following) await unfollow.mutateAsync(academyId);
    else await follow.mutateAsync(academyId);
  };

  return (
    <Button
      type="button"
      variant={following ? "secondary" : "outline"}
      size={size}
      className={cn(
        following &&
          "border-primary/40 bg-primary/5 text-primary hover:border-primary/60 hover:bg-primary/10",
        className
      )}
      disabled={busy || (authChecked === null && loadingFollows)}
      onClick={onClick}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={cn("h-4 w-4", following && "fill-current")} />
      )}
      <span>
        {following ? t("following_label") : t("follow_label")}
        {showCount && followerCount != null && followerCount > 0
          ? ` · ${followerCount}`
          : ""}
      </span>
    </Button>
  );
}