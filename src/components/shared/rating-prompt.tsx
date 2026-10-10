"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LandPlot, Volleyball } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  useRateAcademy,
  useRatePlayground,
  useUnratedAcademyTargets,
  useUnratedPlaygroundTargets,
} from "@/lib/queries";
import type {
  CompletedGameRatingTarget,
  CompletedSessionRatingTarget,
} from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useRealtime } from "@/lib/useRealtime";
import { venueCardPhoto } from "@/lib/venue-media";
import { errorMessage } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  RatingControl,
  type RatingSubmit,
} from "@/components/shared/rating-control";
import { useRatingPrompt } from "@/store/useRatingPrompt";

type PromptEntry =
  | { key: string; occurredAt: string; kind: "venue"; target: CompletedGameRatingTarget }
  | { key: string; occurredAt: string; kind: "academy"; target: CompletedSessionRatingTarget };

/**
 * Asks members to rate the playground they just played a friendly game at, or
 * the academy they just trained at. Rendered once in the member dashboard
 * layout, it mounts quietly and opens at most once per app load — or live when
 * a game flips to "completed" / attendance is marked. Targets a member already
 * rated are never prompted again; rating or dismissing ("Not now", closing)
 * clears it so it isn't nagged.
 */
export function RatingPrompt({ memberId }: { memberId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const playgroundsQuery = useUnratedPlaygroundTargets(memberId);
  const academiesQuery = useUnratedAcademyTargets(memberId);
  const rateVenue = useRatePlayground();
  const rateAcademy = useRateAcademy();
  const dismissedKeys = useRatingPrompt((s) => s.dismissedKeys);
  const dismiss = useRatingPrompt((s) => s.dismiss);
  useRealtime(["friendly_games", "friendly_game_participants", "training_sessions", "attendance"]);

  const dismissed = useMemo(() => new Set(dismissedKeys), [dismissedKeys]);

  const entries = useMemo(() => {
    const list: PromptEntry[] = [];
    for (const item of playgroundsQuery.data ?? []) {
      if (dismissed.has(`venue:${item.venue.id}`)) continue;
      list.push({
        key: `venue:${item.venue.id}`,
        occurredAt: `${item.gameDate}T${item.startTime ?? ""}`,
        kind: "venue",
        target: item,
      });
    }
    for (const item of academiesQuery.data ?? []) {
      if (dismissed.has(`academy:${item.academy.id}`)) continue;
      list.push({
        key: `academy:${item.academy.id}`,
        occurredAt: `${item.sessionDate}T${item.sessionTime ?? ""}`,
        kind: "academy",
        target: item,
      });
    }
    list.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return list;
  }, [playgroundsQuery.data, academiesQuery.data, dismissed]);

  const entry = entries[0] ?? null;

  const [open, setOpen] = useState(false);
  const autoShownRef = useRef(false);

  // Open once per session when a candidate appears; never cascade to the next
  // target after a dismiss/rating within the same session.
  useEffect(() => {
    if (entry && !autoShownRef.current) {
      autoShownRef.current = true;
      setOpen(true);
    }
  }, [entry]);

  useEffect(() => {
    if (open && !entry) setOpen(false);
  }, [open, entry]);

  if (!entry) return null;

  const isVenue = entry.kind === "venue";
  const name = isVenue
    ? entry.target.venue.name
    : entry.target.academy.name;
  const photo = isVenue
    ? venueCardPhoto(entry.target.venue.photos, entry.target.venue.cover_url)
    : entry.target.academy.cover_url ?? entry.target.academy.logo_url;
  const title = t(isVenue ? "rating_prompt_venue_title" : "rating_prompt_academy_title");
  const subtitle = t(isVenue ? "rating_prompt_venue_subtitle" : "rating_prompt_academy_subtitle").replace(
    "{name}",
    name
  );
  const photoAlt = t(isVenue ? "rating_prompt_venue_photo_alt" : "rating_prompt_academy_photo_alt").replace(
    "{name}",
    name
  );
  const FallbackIcon = isVenue ? LandPlot : Volleyball;

  const handleSubmit = async (payload: RatingSubmit) => {
    const kind = entry.kind;
    try {
      if (kind === "venue") {
        await rateVenue.mutateAsync({
          venueId: entry.target.venue.id,
          rating: payload.rating,
          comment: payload.comment,
        });
      } else {
        await rateAcademy.mutateAsync({
          academyId: entry.target.academy.id,
          rating: payload.rating,
          comment: payload.comment,
        });
      }
      toast.success(t("rate_submitted"));
      setOpen(false);
      dismiss(entry.key);
      qc.invalidateQueries({
        queryKey:
          kind === "venue"
            ? [...queryKeys.myGameParticipants, "unrated-targets"]
            : [...queryKeys.sessions, "unrated-academy-targets"],
      });
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
      throw err;
    }
  };

  const handleDismiss = () => {
    dismiss(entry.key);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleDismiss(); }}>
      <DialogContent
        className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-2xl"
        closeButtonClassName="z-10 bg-black/25 text-white hover:bg-black/45 hover:text-white focus-visible:ring-white/60 data-[state=open]:bg-black/25 data-[state=open]:text-white"
      >
        <DialogHeader className="sr-only p-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-brand to-interactive-700 sm:h-48">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={photoAlt}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/90">
              <FallbackIcon className="h-14 w-14" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 space-y-1 p-5">
            <h2 className="text-lg font-bold text-white drop-shadow">{title}</h2>
            <p className="text-sm text-white/90 drop-shadow">{subtitle}</p>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <RatingControl
            size="h-6 w-6"
            idleLabel={t("rating_prompt_tap_hint")}
            onSubmit={handleSubmit}
          />
        </div>

        <DialogFooter className="gap-2 p-6 pt-0 sm:justify-center">
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={handleDismiss}
          >
            {t("rating_prompt_not_now")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}