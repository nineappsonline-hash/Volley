import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Hero band for public listing pages (games, tournaments). */
export function PublicListHero({
  emoji,
  title,
  subtitle,
  note,
  ctaHref = "/signup",
  ctaLabel,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  note?: string;
  ctaHref?: string;
  ctaLabel: string;
}) {
  return (
    <section className="relative overflow-hidden border-b bg-gradient-to-br from-brand via-brand to-interactive-800 py-14 text-white">
      <div className="pointer-events-none absolute -top-24 start-1/2 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-white/15 blur-3xl rtl:translate-x-1/2" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-3 px-6 text-center">
        <span className="text-5xl">{emoji}</span>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="max-w-xl text-sm text-white/85 sm:text-base">{subtitle}</p>
        {note && <p className="max-w-xl text-xs text-white/70">{note}</p>}
        <Button asChild size="lg" className="mt-2 bg-white text-info-ink hover:bg-white/90">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>
    </section>
  );
}

/** Sport-filter chips — plain links so every filter state is indexable. */
export function SportFilterLinks({
  sports,
  to,
  current,
  allLabel,
}: {
  sports: string[];
  to: (name: string) => string;
  current?: string;
  allLabel: string;
}) {
  if (sports.length === 0) return null;
  return (
    <div className="mb-6 flex flex-wrap justify-center gap-2">
      <Link
        href={to("")}
        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
          !current ? "border-brand bg-brand text-white" : "bg-background hover:bg-accent"
        }`}
      >
        {allLabel}
      </Link>
      {sports.map((s) => {
        const href = to(s);
        return (
          <Link
            key={s}
            href={href}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              current === s ? "border-brand bg-brand text-white" : "bg-background hover:bg-accent"
            }`}
          >
            {s}
          </Link>
        );
      })}
    </div>
  );
}
