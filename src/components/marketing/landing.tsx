"use client";

import Link from "next/link";
import {
  CalendarDays,
  ClipboardCheck,
  LineChart,
  Users,
  Volleyball,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useI18n } from "@/lib/i18n";

export function LandingPage() {
  const { t } = useI18n();

  const features = [
    {
      icon: Users,
      title: t("landing_feature_members_title"),
      desc: t("landing_feature_members_desc"),
    },
    {
      icon: ClipboardCheck,
      title: t("landing_feature_attendance_title"),
      desc: t("landing_feature_attendance_desc"),
    },
    {
      icon: Wallet,
      title: t("landing_feature_finances_title"),
      desc: t("landing_feature_finances_desc"),
    },
    {
      icon: LineChart,
      title: t("landing_feature_reports_title"),
      desc: t("landing_feature_reports_desc"),
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-40 start-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl rtl:translate-x-1/2" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white shadow-lg shadow-blue-500/30">
              <Volleyball className="h-6 w-6" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-extrabold">{t("appName")}</span>
              <span className="text-[11px] text-muted-foreground">
                {t("landing_tagline")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button asChild variant="ghost">
              <Link href="/login">{t("landing_signin")}</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">{t("landing_join")}</Link>
            </Button>
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            {t("landing_badge")}
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            {t("landing_hero")}{" "}
            <span className="text-gradient">{t("landing_hero_highlight")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            {t("landing_hero_desc")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href="/signup">
                <Users className="h-5 w-5" />
                {t("landing_signup_member")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login/tenant">
                <CalendarDays className="h-5 w-5" />
                {t("landing_signin_admin")}
              </Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            {t("landing_own_academy")}{" "}
            <Link
              href="/signup/tenant"
              className="font-medium text-primary hover:underline"
            >
              {t("landing_create_academy")} →
            </Link>
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}