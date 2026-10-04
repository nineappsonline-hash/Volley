"use client";

import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { useCurrentProfile } from "@/lib/queries";
import { Menu, Volleyball, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export function AcademyNavigation() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data: profile } = useCurrentProfile();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/dashboard", label: ar ? "الرئيسية" : "Dashboard" },
    { href: "/games", label: ar ? "المباريات" : "Games" },
    { href: "/playgrounds", label: ar ? "الملاعب" : "Playgrounds" },
    { href: "/tournaments", label: ar ? "البطولات" : "Tournaments" },
    { href: "/academies", label: ar ? "الأكاديميات" : "Academies" },
    { href: "/academy-bookings", label: ar ? "حجوزاتي" : "My bookings" },
  ];
  if (profile) return <Topbar role={profile.role} navigationRole="member" name={profile.name} username={profile.username} avatarUrl={profile.avatar_url} avatarId={profile.avatar_id} memberPlan={profile.member_plan} />;
  return <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <Link href="/" className="flex min-h-11 items-center gap-2 text-xl font-extrabold"><Volleyball className="h-6 w-6 text-primary" />Playza</Link>
      <nav aria-label={ar ? "القائمة الرئيسية" : "Main navigation"} className="hidden items-center gap-1 lg:flex">
        {links.map(link => <Link key={link.href} href={link.href} className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-muted">{link.label}</Link>)}
      </nav>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="academy-mobile-menu" className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm lg:hidden">
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}{ar ? "القائمة" : "Menu"}
      </button>
    </div>
    {open && <nav id="academy-mobile-menu" aria-label={ar ? "القائمة الرئيسية" : "Main navigation"} className="grid grid-cols-2 gap-2 border-t p-4 lg:hidden">
      {links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-xl bg-muted/50 p-3 text-sm font-medium hover:bg-muted">{link.label}</Link>)}
    </nav>}
  </header>;
}
