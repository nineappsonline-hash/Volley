"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpLeft, ChevronDown, HelpCircle, MessageCircle } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { PublicListHero } from "@/components/public/public-listing-ui";
import { useI18n, type Dict } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ContactFormDialog } from "@/components/contact/contact-form-dialog";

type FaqCategory = "general" | "members" | "games" | "owners" | "technical";

type FaqItem = { q: keyof Dict; a: keyof Dict };

const CATEGORIES: FaqCategory[] = [
  "general",
  "members",
  "games",
  "owners",
  "technical",
];

const ITEMS: Record<FaqCategory, FaqItem[]> = {
  general: [
    { q: "faq_item_general_what_q", a: "faq_item_general_what_a" },
    { q: "faq_item_general_free_q", a: "faq_item_general_free_a" },
    { q: "faq_item_general_roles_q", a: "faq_item_general_roles_a" },
    {
      q: "faq_item_general_member_needed_q",
      a: "faq_item_general_member_needed_a",
    },
  ],
  members: [
    { q: "faq_item_members_children_q", a: "faq_item_members_children_a" },
    { q: "faq_item_members_plans_q", a: "faq_item_members_plans_a" },
    { q: "faq_item_members_payment_q", a: "faq_item_members_payment_a" },
    { q: "faq_item_members_qr_q", a: "faq_item_members_qr_a" },
    {
      q: "faq_item_members_remaining_q",
      a: "faq_item_members_remaining_a",
    },
  ],
  games: [
    { q: "faq_item_games_find_q", a: "faq_item_games_find_a" },
    { q: "faq_item_games_price_q", a: "faq_item_games_price_a" },
    { q: "faq_item_games_chat_q", a: "faq_item_games_chat_a" },
    {
      q: "faq_item_games_tournament_join_q",
      a: "faq_item_games_tournament_join_a",
    },
    {
      q: "faq_item_games_tournament_type_q",
      a: "faq_item_games_tournament_type_a",
    },
    {
      q: "faq_item_games_tournament_organize_q",
      a: "faq_item_games_tournament_organize_a",
    },
  ],
  owners: [
    { q: "faq_item_owners_create_q", a: "faq_item_owners_create_a" },
    { q: "faq_item_owners_trial_q", a: "faq_item_owners_trial_a" },
    { q: "faq_item_owners_plans_q", a: "faq_item_owners_plans_a" },
    { q: "faq_item_owners_collect_q", a: "faq_item_owners_collect_a" },
    {
      q: "faq_item_owners_attendance_q",
      a: "faq_item_owners_attendance_a",
    },
    { q: "faq_item_owners_profit_q", a: "faq_item_owners_profit_a" },
    {
      q: "faq_item_owners_public_page_q",
      a: "faq_item_owners_public_page_a",
    },
  ],
  technical: [
    { q: "faq_item_tech_devices_q", a: "faq_item_tech_devices_a" },
    { q: "faq_item_tech_install_q", a: "faq_item_tech_install_a" },
    { q: "faq_item_tech_security_q", a: "faq_item_tech_security_a" },
    { q: "faq_item_tech_calendar_q", a: "faq_item_tech_calendar_a" },
  ],
};

export function FaqPage() {
  const { t, lang, dir } = useI18n();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <main dir={dir} lang={lang === "ar" ? "ar-EG" : "en"} className="min-h-screen bg-background">
      {/* Simple public top bar so visitors can go home / switch language. */}
      <header className="flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <Link href="/" aria-label={t("faq_back_home")}>
          <AppLogo className="w-24" />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ContactFormDialog
            trigger={
              <button
                type="button"
                className="hidden rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex"
              >
                {t("contact_menu")}
              </button>
            }
          />
          <Link
            href="/"
            className="hidden rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex"
          >
            {t("faq_back_home")}
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t("faq_hero_cta")} <ArrowUpLeftIcon rtl={dir === "rtl"} />
          </Link>
        </div>
      </header>

      <PublicListHero
        emoji="❓"
        title={t("faq_hero_title")}
        subtitle={t("faq_hero_subtitle")}
        note={t("faq_hero_note")}
        ctaLabel={t("faq_hero_cta")}
      />

      {/* Category jump links */}
      <nav
        aria-label={t("faq_hero_title")}
        className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2 px-6 pt-10"
      >
        {CATEGORIES.map((cat) => (
          <a
            key={cat}
            href={`#cat-${cat}`}
            className="rounded-full border bg-background px-4 py-1.5 text-sm font-medium hover:bg-accent"
          >
            {t(`faq_cat_${cat}` as keyof Dict)}
          </a>
        ))}
      </nav>

      <div className="mx-auto max-w-3xl space-y-10 px-6 py-10">
        {CATEGORIES.map((cat) => (
          <section key={cat} id={`cat-${cat}`} className="scroll-mt-20">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold">
              <HelpCircle className="h-5 w-5 text-primary" />
              {t(`faq_cat_${cat}` as keyof Dict)}
            </h2>
            <div className="space-y-3">
              {ITEMS[cat].map(({ q, a }, i) => {
                const key = `${cat}-${i}`;
                const isOpen = Boolean(open[key]);
                return (
                  <div
                    key={key}
                    className={cn(
                      "overflow-hidden rounded-xl border bg-card transition-colors",
                      isOpen && "border-primary/40"
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggle(key)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start font-bold"
                    >
                      <span>{t(q)}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-180 text-primary"
                        )}
                      />
                    </button>
                    {isOpen && (
                      <p className="border-t px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                        {t(a)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Still need help */}
        <section className="flex flex-col items-center gap-4 rounded-2xl border bg-muted/30 px-6 py-12 text-center">
          <MessageCircle className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-extrabold">{t("faq_still_title")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("faq_still_desc")}
          </p>
          <Link
            href="/signup"
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t("faq_still_cta")} <ArrowUpLeftIcon rtl={dir === "rtl"} />
          </Link>
        </section>
      </div>
    </main>
  );
}

function ArrowUpLeftIcon({ rtl }: { rtl: boolean }) {
  return (
    <span className="inline-block" style={{ transform: rtl ? "scaleX(-1)" : undefined }}>
      <ArrowUpLeft size={18} />
    </span>
  );
}