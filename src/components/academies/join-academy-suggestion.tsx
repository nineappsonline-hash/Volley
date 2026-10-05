"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AcademyLogo } from "@/components/academies/academy-logo";
import {
  joinPublicAcademy,
  useAcademyRatings,
  usePublicAcademies,
  usePublicSports,
} from "@/lib/queries";
import { sportLabel } from "@/lib/sport-labels";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Decorative backdrop: slow-drifting colour behind the modal. */
function AuroraBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="animate-suggest-float absolute -top-16 -start-10 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />
      <div
        className="animate-suggest-float absolute -bottom-20 -end-12 h-56 w-56 rounded-full bg-accent/25 blur-3xl"
        style={{ animationDelay: "-4.5s" }}
      />
    </div>
  );
}

type Phase = "sport" | "academies" | "joined";

/**
 * Offered once, right after a brand new member signs up: pick a favourite sport
 * and see the academies near them that actually teach it. Joining is entirely
 * optional — "maybe later" simply continues to the dashboard.
 */
export function JoinAcademySuggestion({
  open,
  onOpenChange,
  onDone,
  memberName,
  highlightAcademyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the member moves on, whether they joined or skipped. */
  onDone?: () => void;
  memberName?: string | null;
  /** The academy they came from, surfaced first so it is not lost. */
  highlightAcademyId?: string | null;
}) {
  const { t } = useI18n();
  const { data: academies } = usePublicAcademies();
  const { data: sports } = usePublicSports();
  const { data: ratings } = useAcademyRatings();

  const [phase, setPhase] = useState<Phase>("sport");
  const [sport, setSport] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ name: string; id: string } | null>(null);

  // Sports ranked by how many academies teach them, so the most useful choice
  // is on screen without scrolling.
  const sportOptions = useMemo(() => {
    const counts = new Map<string, number>();
    (sports ?? []).forEach((row) =>
      counts.set(row.name, (counts.get(row.name) ?? 0) + 1)
    );
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [sports]);

  const matches = useMemo(() => {
    if (!sport) return [];
    const ids = new Set(
      (sports ?? [])
        .filter((row) => row.name === sport)
        .map((row) => row.academy_id)
    );
    return (academies ?? [])
      .filter((academy) => ids.has(academy.id))
      .sort((a, b) =>
        a.id === highlightAcademyId ? -1 : b.id === highlightAcademyId ? 1 : 0
      );
  }, [academies, sports, sport, highlightAcademyId]);

  const ratingByAcademy = useMemo(() => {
    const map = new Map<string, { avg: number; count: number }>();
    (ratings ?? []).forEach((rating) => {
      const entry = map.get(rating.academy_id) ?? { avg: 0, count: 0 };
      entry.avg += rating.rating;
      entry.count += 1;
      map.set(rating.academy_id, entry);
    });
    return map;
  }, [ratings]);

  const close = () => {
    onOpenChange(false);
    onDone?.();
  };

  const reset = () => {
    setPhase("sport");
    setSport(null);
    setJoined(null);
    setJoiningId(null);
    setFailedId(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? null : close())}
    >
      <DialogContent
        className="overflow-hidden border-0 p-0 sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AuroraBackdrop />

        {/* The entrance animation lives on an inner element so it layers over
            the dialog's own zoom rather than replacing it. */}
        <div className="animate-suggest-rise relative">
          {phase === "sport" && (
            <div className="p-6">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-5 text-primary-foreground">
                <div className="animate-suggest-sheen pointer-events-none absolute inset-y-0 -start-1/3 w-1/3 bg-white/20 blur-md" />
                <div className="flex items-center gap-3">
                  <span className="relative flex h-12 w-12 items-center justify-center">
                    <span className="animate-suggest-ring absolute inset-0 rounded-full bg-white/40" />
                    <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                      <Trophy className="h-6 w-6" />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/80">
                      {t("suggest_welcome_badge")}
                    </p>
                    <p className="truncate text-lg font-bold">
                      {t("suggest_welcome_title")}
                      {memberName ? `, ${memberName.split(" ")[0]}` : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-primary-foreground/90">
                  {t("suggest_sport_question")}
                </p>
              </div>

              <DialogHeader className="sr-only">
                <DialogTitle>{t("suggest_welcome_title")}</DialogTitle>
                <DialogDescription>
                  {t("suggest_sport_question")}
                </DialogDescription>
              </DialogHeader>

              {sportOptions.length === 0 ? (
                <div className="py-10 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="mt-4 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pe-1 sm:grid-cols-3">
                  {sportOptions.map((option, index) => (
                    <button
                      key={option.name}
                      type="button"
                      style={{ "--i": index } as React.CSSProperties}
                      onClick={() => {
                        setSport(option.name);
                        setPhase("academies");
                      }}
                      className="animate-suggest-stagger group flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-xl border bg-card p-3 text-start text-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="font-medium">
                        {sportLabel(option.name, t)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("suggest_academy_count").replace(
                          "{n}",
                          String(option.count)
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <Button
                variant="ghost"
                className="mt-4 w-full"
                onClick={resetAndClose(reset, close)}
              >
                {t("suggest_skip")}
              </Button>
            </div>
          )}

          {phase === "academies" && (
            <div className="p-6">
              <button
                type="button"
                onClick={() => setPhase("sport")}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t("suggest_back")}
              </button>

              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <DialogTitle className="text-lg">
                  {t("suggest_matches_title").replace(
                    "{sport}",
                    sport ? sportLabel(sport, t) : ""
                  )}
                </DialogTitle>
              </div>
              <DialogDescription className="mt-1">
                {t("suggest_matches_hint")}
              </DialogDescription>

              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pe-1">
                {matches.length === 0 && (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t("suggest_no_matches")}
                  </p>
                )}
                {matches.map((academy, index) => {
                  const rating = ratingByAcademy.get(academy.id);
                  const isJoining = joiningId === academy.id;
                  const didFail = failedId === academy.id;
                  return (
                    <div
                      key={academy.id}
                      style={{ "--i": index } as React.CSSProperties}
                      className={cn(
                        "animate-suggest-stagger flex items-center gap-3 rounded-xl border p-3 transition-all",
                        academy.id === highlightAcademyId &&
                          "border-primary bg-primary/5",
                        didFail && "animate-suggest-shake border-destructive"
                      )}
                    >
                      <AcademyLogo
                        academyId={academy.id}
                        name={academy.name}
                        logoUrl={academy.logo_url}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{academy.name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[academy.area, academy.governorate, academy.country]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        {rating && rating.count > 0 && (
                          <p className="mt-0.5 flex items-center gap-0.5 text-xs text-attention-500">
                            <Star className="h-3 w-3 fill-current" />
                            <span dir="ltr">
                              {(rating.avg / rating.count).toFixed(1)}
                            </span>
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        disabled={isJoining}
                        onClick={async () => {
                          setJoiningId(academy.id);
                          setFailedId(null);
                          try {
                            const { data, error } =
                              await joinPublicAcademy(academy.id);
                            if (error) throw error;
                            if (data) {
                              setJoined({ name: academy.name, id: academy.id });
                              setPhase("joined");
                              toast.success(t("suggest_joined_toast"));
                            } else {
                              toast.info(t("directory_already"));
                              close();
                            }
                          } catch (error) {
                            setFailedId(academy.id);
                            toast.error(
                              errorMessage(error, t("sa_action_failed"))
                            );
                          } finally {
                            setJoiningId(null);
                          }
                        }}
                      >
                        {isJoining ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          t("suggest_join")
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <Button variant="ghost" className="mt-4 w-full" onClick={close}>
                {t("suggest_later")}
              </Button>
            </div>
          )}

          {phase === "joined" && (
            <div className="p-8 text-center">
              <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
                <span className="animate-suggest-burst absolute inset-0 rounded-full bg-primary/40" />
                <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-lg">
                  <svg viewBox="0 0 52 52" className="h-12 w-12" aria-hidden="true">
                    <path
                      d="M14 27l8 8 16-18"
                      fill="none"
                      stroke="white"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="48"
                      strokeDashoffset="48"
                      className="animate-suggest-draw"
                    />
                  </svg>
                </span>
              </div>
              <DialogTitle className="mt-4 text-xl">
                {t("suggest_joined_title")}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {t("suggest_joined_body").replace(
                  "{academy}",
                  joined?.name ?? ""
                )}
              </DialogDescription>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  onClick={close}
                >
                  {t("suggest_go_dashboard")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setJoined(null);
                    setPhase("sport");
                  }}
                >
                  {t("suggest_another_sport")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function resetAndClose(reset: () => void, close: () => void) {
  return () => {
    reset();
    close();
  };
}