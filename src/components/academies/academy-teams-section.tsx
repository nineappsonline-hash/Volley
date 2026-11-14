"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, MapPin, Search, SlidersHorizontal, Users } from "lucide-react";
import { AcademyLogo } from "@/components/academies/academy-logo";
import { SportIcon } from "@/components/marketing/sport-icons";
import { useI18n } from "@/lib/i18n";
import type { PublicTeamDirectoryEntry } from "@/lib/types";

export function AcademyTeamsSection({ teams }: { teams: PublicTeamDirectoryEntry[] }) {
  const { lang, t } = useI18n();
  const ar = lang === "ar";
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("all");
  const [area, setArea] = useState("all");
  const [ageGroup, setAgeGroup] = useState("all");
  const sports = useMemo(() => [...new Set(teams.map(team => team.sport?.name ?? t("directory_teams_other_sport")))].sort(), [teams, t]);
  const areas = useMemo(() => [...new Set(teams.map(team => team.venue?.area || team.academy.area || team.venue?.governorate || team.academy.governorate).filter((value): value is string => Boolean(value)))].sort(), [teams]);
  const filtered = useMemo(() => teams.filter(team => {
    const selectedArea = team.venue?.area || team.academy.area || team.venue?.governorate || team.academy.governorate;
    const matchesAge = ageGroup === "all" || (ageGroup === "kids" ? (team.min_age ?? 0) < 13 : ageGroup === "teens" ? (team.min_age ?? 0) <= 18 && (team.max_age ?? 99) >= 13 : (team.max_age ?? 99) >= 18);
    return (sport === "all" || (team.sport?.name ?? t("directory_teams_other_sport")) === sport)
      && (area === "all" || selectedArea === area)
      && matchesAge
      && [team.name, team.academy.name, team.sport?.name, team.venue?.name, team.venue?.address, team.venue?.area, team.venue?.governorate, team.academy.area, team.academy.governorate].some(value => value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  }), [teams, sport, area, ageGroup, query, t]);

  const selectClass = "min-h-11 min-w-0 rounded-xl border border-[#e8e2f1] bg-[#f0ecfa] px-4 text-sm font-semibold text-[#5d35c5] outline-none focus-visible:ring-2 focus-visible:ring-[#5d35c5]";
  return <section aria-labelledby="academy-teams-heading" className="bg-[#f7f5fc] px-4 pb-20 pt-12 text-[#19132e] sm:px-6 sm:pt-16">
    <div className="mx-auto max-w-7xl">
      <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5d35c5]">{ar ? "اكتشف مستواك الجاي" : "DISCOVER YOUR NEXT LEVEL"}</p>
      <h1 id="academy-teams-heading" className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">{ar ? "لاقي الأكاديمية المناسبة ليك." : "Find the right academy."}</h1>
      <p className="mt-4 max-w-2xl text-base text-[#706b80] sm:text-lg">{ar ? "تدريب مميز، مدربين شاطرين، وناس بتحب نفس رياضتك." : "Great training. Great coaches. Your kind of game."}</p>

      <div className="mt-9 flex flex-col gap-3 rounded-[22px] border border-[#e8e2f1] bg-white p-4 shadow-[0_16px_45px_-30px_rgba(50,27,98,.25)] lg:flex-row lg:items-center">
        <label className="flex min-h-12 flex-1 items-center gap-3 rounded-xl bg-[#f7f5fc] px-4 focus-within:ring-2 focus-within:ring-[#5d35c5]/30">
          <Search size={19} className="shrink-0 text-[#706b80]" aria-hidden="true" />
          <span className="sr-only">{ar ? "بحث عن أكاديمية أو منطقة" : "Search academy or location"}</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? "اسم الأكاديمية أو الرياضة أو المنطقة" : "Academy, sport or location"} className="w-full min-w-0 bg-transparent py-3 text-sm outline-none placeholder:text-[#706b80]" />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
          <label className="sr-only" htmlFor="academy-sport">{ar ? "الرياضة" : "Sport"}</label>
          <select id="academy-sport" className={selectClass} value={sport} onChange={e => setSport(e.target.value)}><option value="all">{ar ? "كل الرياضات" : "All sports"}</option>{sports.map(value => <option key={value} value={value}>{value}</option>)}</select>
          <label className="sr-only" htmlFor="academy-area">{ar ? "المنطقة" : "Area"}</label>
          <select id="academy-area" className={selectClass} value={area} onChange={e => setArea(e.target.value)}><option value="all">{ar ? "كل المناطق" : "All locations"}</option>{areas.map(value => <option key={value} value={value}>{value}</option>)}</select>
          <label className="sr-only" htmlFor="academy-age">{ar ? "الفئة العمرية" : "Age group"}</label>
          <select id="academy-age" className={selectClass} value={ageGroup} onChange={e => setAgeGroup(e.target.value)}><option value="all">{ar ? "كل الأعمار" : "All ages"}</option><option value="kids">{ar ? "أطفال" : "Kids"}</option><option value="teens">{ar ? "ناشئين" : "Teens"}</option><option value="adults">{ar ? "كبار" : "Adults"}</option></select>
        </div>
        <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5d35c5] px-5 text-sm font-bold text-white"><SlidersHorizontal size={16} />{ar ? `${filtered.length} نتيجة` : `${filtered.length} results`}</div>
      </div>

      <div className="mb-6 mt-12 flex items-center justify-between gap-3">
        <div><p className="text-xs font-bold tracking-[.16em] text-[#5d35c5]">{ar ? "الأكاديميات والفرق" : "ACADEMIES & TEAMS"}</p><h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">{ar ? "اكتشف برامج التدريب" : "Explore training programs"}</h2></div>
      </div>
      {filtered.length === 0 ? <div className="rounded-3xl border border-[#e8e2f1] bg-white px-6 py-14 text-center text-[#706b80]">{teams.length === 0 ? t("directory_teams_empty") : ar ? "مفيش نتائج مطابقة. جرّب تغير الفلاتر." : "No matches. Try adjusting your filters."}</div> :
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map(team => {
        const location = [team.venue?.area || team.academy.area, team.venue?.governorate || team.academy.governorate].filter(Boolean).join(" · ");
        const age = team.min_age != null && team.max_age != null ? `${team.min_age}–${team.max_age}` : team.min_age != null ? `${team.min_age}+` : team.max_age != null ? `≤ ${team.max_age}` : null;
        return <article key={team.id} className="group flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#e8e2f1] bg-white p-3 shadow-[0_12px_38px_-28px_rgba(46,23,99,.32)] transition-all hover:-translate-y-1 hover:shadow-[0_22px_50px_-24px_rgba(46,23,99,.3)]">
          <div className="relative flex h-44 items-start justify-between overflow-hidden rounded-2xl bg-[#e8e2ff] p-5">
            <div className="absolute -bottom-16 -end-8 h-56 w-56 rounded-full bg-[#c8b8f9]/60" aria-hidden="true" />
            <div className="relative z-10"><p className="text-xs font-extrabold uppercase tracking-wider text-[#5d35c5]">{team.sport?.name ?? t("directory_teams_other_sport")}</p><p className="mt-5 max-w-[180px] text-xl font-extrabold leading-tight text-[#19132e]">{team.name}</p></div>
            <div className="relative z-10 rounded-full bg-white/60 p-5 text-[#5d35c5]"><SportIcon id={(team.sport?.name ?? "").toLowerCase()} size={44} /></div>
          </div>
          <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
            <div className="flex items-center gap-3"><AcademyLogo academyId={team.academy.id} name={team.academy.name} logoUrl={team.academy.logo_url} /><div className="min-w-0"><Link href={`/a/${team.academy.slug}`} className="block truncate text-lg font-extrabold text-[#19132e] hover:text-[#5d35c5]">{team.academy.name}</Link><p className="mt-1 text-sm text-[#706b80]">{team.name}</p></div></div>
            <div className="mt-4 flex flex-wrap gap-2">{age && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0ecfa] px-3 py-1.5 text-xs font-semibold text-[#5d35c5]"><CalendarDays size={13} />{age}</span>}<span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0ecfa] px-3 py-1.5 text-xs font-semibold text-[#5d35c5]"><Users size={13} />{t(`teams_gender_${team.gender}`)}</span></div>
            {location && <p className="mt-4 flex items-center gap-2 text-sm text-[#706b80]"><MapPin size={16} className="shrink-0" />{location}</p>}
            <Link href={`/training/${team.id}`} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5d35c5] px-4 text-sm font-bold text-white transition-colors hover:bg-[#4925a5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5d35c5]">{ar ? "شوف تفاصيل التدريب" : "View training details"}<ArrowUpRight size={17} /></Link>
          </div>
        </article>;
      })}</div>}
    </div>
  </section>;
}
