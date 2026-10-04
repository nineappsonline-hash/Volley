import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the real dashboard shape (hero, action strip, games, training,
 * tournaments, discovery) so the page does not jump when data lands.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-8" aria-hidden="true">
      {/* Hero */}
      <div className="overflow-hidden rounded-[20px] border">
        <div className="flex justify-between gap-6 bg-muted/60 p-7">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[86px] w-full rounded-xl" />
          ))}
        </div>
      </div>

      {/* Action strip */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />
        ))}
      </div>

      {/* Section: games, grouped by day */}
      <section className="space-y-3">
        <Skeleton className="h-2 w-16" />
        <div className="rounded-2xl border p-6">
          <Skeleton className="h-5 w-48" />
          <div className="mt-5 space-y-5">
            {[0, 1].map((group) => (
              <div key={group} className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <div className="grid gap-4 md:grid-cols-2">
                  {[0, 1].map((card) => (
                    <Skeleton key={card} className="h-44 w-full rounded-2xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section: training */}
      <section className="space-y-3">
        <Skeleton className="h-2 w-16" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </section>

      {/* Section: tournaments */}
      <section className="space-y-3">
        <Skeleton className="h-2 w-16" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </section>

      {/* Section: discovery carousels */}
      <section className="space-y-6">
        <Skeleton className="h-2 w-16" />
        {[0, 1].map((carousel) => (
          <div key={carousel} className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((card) => (
                <Skeleton key={card} className="h-56 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}