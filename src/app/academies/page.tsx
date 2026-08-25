"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MapPin, Star, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  joinPublicAcademy,
  useAcademyRatings,
  usePublicAcademies,
  usePublicSports,
  useRateAcademy,
} from "@/lib/queries";

function Stars({
  value,
  size = "h-4 w-4",
}: {
  value: number;
  size?: string;
}) {
  return (
    <span className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${size} ${
            i <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
    </span>
  );
}

export default function AcademiesDirectoryPage() {
  const { t } = useI18n();
  const router = useRouter();

  const { data: academies, isLoading } = usePublicAcademies();
  const { data: sports } = usePublicSports();
  const { data: ratings } = useAcademyRatings();
  const rate = useRateAcademy();

  const [myId, setMyId] = useState<string | null>(null);
  const [myAcademyId, setMyAcademyId] = useState<string | null | undefined>(
    undefined
  );
  const [joining, setJoining] = useState<string | null>(null);

  // Who am I? Anonymous visitors can browse but not join or rate.
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setMyId(null);
        setMyAcademyId(undefined);
        return;
      }
      setMyId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("academy_id")
        .eq("id", user.id)
        .maybeSingle();
      if (alive) setMyAcademyId(profile?.academy_id ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const statsByAcademy = useMemo(() => {
    const map = new Map<
      string,
      { avg: number; count: number; mine?: number }
    >();
    for (const r of ratings ?? []) {
      const s = map.get(r.academy_id) ?? { avg: 0, count: 0 };
      const total = s.avg * s.count + r.rating;
      s.count += 1;
      s.avg = total / s.count;
      map.set(r.academy_id, s);
    }
    if (myId) {
      for (const r of ratings ?? []) {
        if (r.member_id === myId) {
          const s = map.get(r.academy_id);
          if (s) s.mine = r.rating;
        }
      }
    }
    return map;
  }, [ratings, myId]);

  const sportsByAcademy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of sports ?? []) {
      const list = map.get(s.academy_id) ?? [];
      list.push(s.name);
      map.set(s.academy_id, list);
    }
    return map;
  }, [sports]);

  const onJoin = async (academyId: string) => {
    if (!myId) {
      router.push("/signup");
      return;
    }
    setJoining(academyId);
    try {
      const { data: ok, error } = await joinPublicAcademy(academyId);
      if (error) throw error;
      if (ok) {
        toast.success(t("directory_joined"));
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.info(t("directory_already"));
      }
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setJoining(null);
    }
  };

  const onRate = async (academyId: string, value: number) => {
    try {
      await rate.mutateAsync({ academyId, rating: value });
      toast.success(t("rate_submitted"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 py-14 text-white">
        <div className="pointer-events-none absolute -top-24 start-1/2 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-white/15 blur-3xl rtl:translate-x-1/2" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Volleyball className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            {t("directory_title")}
          </h1>
          <p className="max-w-xl text-sm text-white/85">
            {t("directory_subtitle")}
          </p>
          {!myId && (
            <Button asChild variant="secondary" className="mt-2">
              <Link href="/signup">{t("directory_login_to_join")}</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Directory */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : (academies ?? []).length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">
            {t("directory_empty")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {(academies ?? []).map((a) => {
              const stat = statsByAcademy.get(a.id);
              const academySports = sportsByAcademy.get(a.id) ?? [];
              const joined = myAcademyId != null && myAcademyId !== undefined;
              return (
                <Card key={a.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-start justify-between gap-2">
                      <Link
                        href={a.slug ? `/a/${a.slug}` : "#"}
                        className="hover:underline"
                      >
                        {a.name}
                      </Link>
                      {stat ? (
                        <span className="flex flex-col items-end gap-0.5 text-xs font-normal text-muted-foreground">
                          <Stars value={stat.avg} />
                          {stat.count > 0 &&
                            t("directory_reviews").replace(
                              "{n}",
                              String(stat.count)
                            )}
                        </span>
                      ) : (
                        <span className="whitespace-nowrap text-xs font-normal text-muted-foreground">
                          {t("directory_no_rating")}
                        </span>
                      )}
                    </CardTitle>
                    {a.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {a.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    {academySports.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {academySports.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {a.address || t("directory_no_address")}
                    </p>

                    {/* Rate (registered members only) */}
                    {myId && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {t("directory_your_rating")}:
                        {[1, 2, 3, 4, 5].map((i) => (
                          <button
                            key={i}
                            type="button"
                            aria-label={`${i}`}
                            disabled={rate.isPending}
                            onClick={() => onRate(a.id, i)}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                i <= (stat?.mine ?? 0)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/40"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto pt-2">
                      {joined ? (
                        <Button variant="outline" className="w-full" disabled>
                          {t("directory_already")}
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          disabled={joining === a.id}
                          onClick={() => onJoin(a.id)}
                        >
                          {joining === a.id && <Loader2 className="animate-spin" />}
                          {myId ? t("directory_join") : t("directory_login_to_join")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-muted-foreground">
          {t("signup_have_account")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("signup_login_link")}
          </Link>
        </p>
      </div>
    </main>
  );
}
