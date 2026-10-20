"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatTime12h } from "@/lib/constants";
import type { PublicTournament } from "@/lib/public-games";
import type { PublicCourt } from "@/lib/public-playgrounds";

export function PublicTournamentBrowser({ tournaments }: { tournaments: PublicTournament[] }) {
  const { lang } = useI18n();
  const params = useSearchParams();
  const ar = lang === "ar";
  const [sport, setSport] = useState("");
  const sports = [...new Set(tournaments.flatMap(t => t.sport ? [t.sport] : []))];
  const shown = tournaments.filter(t => !sport || t.sport === sport);
  return <section className="space-y-4"><h1 className="text-2xl font-extrabold">{ar ? "البطولات" : "Tournaments"}</h1>
    <label className="block text-sm">{ar ? "الرياضة" : "Sport"}<select value={sport} onChange={e => setSport(e.target.value)} className="ms-3 rounded-lg border bg-card p-2"><option value="">{ar ? "كل الرياضات" : "All sports"}</option>{sports.map(s => <option key={s}>{s}</option>)}</select></label>
    {!shown.length && <p className="rounded-xl border border-dashed p-5">{ar ? "لا توجد بطولات متاحة حالياً." : "No public tournaments available yet."}</p>}
    {shown.map(t => <details key={t.id} open={params.get("focus") === t.id || undefined} className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-bold">{t.name}<span className="ms-3 text-xs font-normal text-muted-foreground">{t.sport} · {t.start_date}</span></summary>
      <div className="mt-4 space-y-3 text-sm"><p>{t.description}</p><p>{[t.venue?.name, t.venue?.area, t.venue?.governorate].filter(Boolean).join(" · ")}</p>{t.start_time && <p>{formatTime12h(t.start_time, lang)}</p>}<p>{t.participant_fee == null ? (ar ? "التكلفة غير محددة" : "Price not set") : formatMoney(t.participant_fee, lang)}</p><p>{t.participant_count}{t.max_participants != null ? ` / ${t.max_participants}` : ""} {ar ? "مشارك" : "participants"}</p>{t.prize && <p>{t.prize}</p>}{t.academy?.slug && <Link className="inline-block font-semibold underline" href={`/a/${encodeURIComponent(t.academy.slug)}`}>{ar ? "عرض الأكاديمية المنظمة" : "View hosting academy"}</Link>}</div>
    </details>)}
  </section>;
}

export function PublicCourtBrowser({ courts }: { courts: PublicCourt[] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [search, setSearch] = useState("");
  const shown = courts.filter(c => [c.name, c.area, c.governorate, c.sport?.name].some(value => value?.toLowerCase().includes(search.trim().toLowerCase())));
  return <section className="space-y-4"><h1 className="text-2xl font-extrabold">{ar ? "الملاعب" : "Courts"}</h1><label className="block text-sm">{ar ? "ابحث بالاسم أو المكان أو الرياضة" : "Search by name, location or sport"}<input className="mt-2 block w-full rounded-xl border bg-card p-3" value={search} onChange={e => setSearch(e.target.value)} /></label>
    {!shown.length && <p className="rounded-xl border border-dashed p-5">{ar ? "لا توجد ملاعب مطابقة." : "No matching courts."}</p>}
    {shown.map(c => <article key={c.id} className="space-y-2 rounded-xl border bg-card p-4"><h2 className="font-bold">{c.name}</h2><p className="text-sm text-muted-foreground">{[c.sport?.name, c.governorate, c.area].filter(Boolean).join(" · ")}</p>{c.booking_price?.full_court != null && <p>{ar ? "الملعب بالكامل (ساعة)" : "Full court (1 hour)"}: {formatMoney(c.booking_price?.full_court, lang)}</p>}<Link className="inline-block font-semibold underline" href={`/p/${encodeURIComponent(c.id)}`}>{ar ? "التفاصيل والمواعيد" : "Details & availability"}</Link></article>)}
  </section>;
}
