"use client";

import { usePathname } from "next/navigation";
import { Building2, CalendarDays, Compass, Crown, Heart, LandPlot, ShoppingBag, Sparkles, Trophy, Users, UserRound } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

/** Shared visual identity for page introductions, with section-specific art. */
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  const path = usePathname() ?? "";
  const theme = path === "/admin"
    ? { color: "from-slate-900 via-indigo-900 to-purple-900", icon: Crown }
    : path.includes("tournament") || path.includes("leaderboard")
    ? { color: "from-fuchsia-900 via-purple-800 to-indigo-800", icon: Trophy }
    : path.includes("playground") || path.includes("rental")
      ? { color: "from-orange-900 via-orange-800 to-rose-800", icon: LandPlot }
      : path.includes("academ") || path.includes("schedule") || path.includes("attendance")
        ? { color: "from-teal-900 via-teal-800 to-emerald-800", icon: path.includes("academ") ? Building2 : CalendarDays }
        : path.includes("community") || path.includes("following") || path.includes("team") || path.includes("member") || path.includes("coach")
          ? { color: "from-blue-900 via-blue-800 to-cyan-800", icon: Users }
          : path.includes("profile") ? { color: "from-indigo-900 via-violet-800 to-purple-800", icon: UserRound }
            : path.includes("parent") ? { color: "from-rose-900 via-pink-800 to-purple-800", icon: Heart }
              : path.includes("marketplace") || path.includes("checkout") || path.includes("upgrade")
                ? { color: "from-emerald-900 via-teal-800 to-blue-800", icon: ShoppingBag }
                : { color: "from-indigo-900 via-blue-800 to-violet-800", icon: Compass };
  const Icon = theme.icon;
  return (
    <header className={`relative isolate overflow-hidden rounded-3xl bg-gradient-to-br ${theme.color} px-5 py-6 text-white sm:px-7 sm:py-8`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -end-16 -top-20 h-64 w-64 rounded-full border-[24px] border-white/10" />
        <div className="absolute -bottom-12 end-24 h-40 w-40 rotate-12 rounded-3xl border border-white/15 bg-white/5" />
        <Icon className="absolute end-5 top-5 h-24 w-24 -rotate-12 text-white/15 sm:end-10 sm:h-32 sm:w-32" strokeWidth={1} />
        <Sparkles className="absolute bottom-5 end-6 h-8 w-8 text-amber-200/40" />
      </div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <span aria-hidden="true" className="mb-3 inline-flex rounded-xl border border-white/20 bg-white/10 p-2"><Icon className="h-5 w-5" /></span>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90">{subtitle}</p>}
        </div>
        {children && <div className="relative flex flex-wrap items-center gap-2 rounded-2xl bg-background/95 p-2 text-foreground shadow-sm">{children}</div>}
      </div>
    </header>
  );
}
