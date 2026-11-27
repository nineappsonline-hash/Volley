"use client";

import Link from "next/link";
import { AppLogo } from "@/components/shared/app-logo";
import { useI18n } from "@/lib/i18n";
import { ArrowUpRight } from "lucide-react";

const sections = [
  {
    en: "Explore", ar: "اكتشف",
    links: [
      { href: "/games", en: "Games", ar: "الماتشات" },
      { href: "/courts", en: "Courts", ar: "الملاعب" },
      { href: "/academies", en: "Academies", ar: "الأكاديميات" },
      { href: "/tournaments", en: "Tournaments", ar: "البطولات" },
    ],
  },
  {
    en: "Playza", ar: "بلايزا",
    links: [
      { href: "/list-your-court", en: "List your court", ar: "أضف ملعبك" },
      { href: "/academy-management", en: "For academy owners", ar: "لأصحاب الأكاديميات" },
      { href: "/faq", en: "FAQs", ar: "أسئلة شائعة" },
      { href: "/shop", en: "Playza Shop", ar: "متجر بلايزا" },
    ],
  },
] as const;

export function PlayzaFooter({ fullBleed = false }: { fullBleed?: boolean } = {}) {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  return <footer dir={dir} className={`${fullBleed ? "relative left-1/2 w-screen -translate-x-1/2" : "mt-12"} border-t border-[#64417f]/50 bg-[#10091b] text-[#f8f2ff]`}>
    <div className="mx-auto grid w-full max-w-[1600px] gap-8 px-5 pb-8 pt-9 sm:grid-cols-[1.6fr_1fr_1fr] sm:px-8 sm:pt-12">
      <div className="max-w-sm">
        <Link href="/" aria-label="Playza" className="inline-flex rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ccff00]">
          <AppLogo className="h-auto w-32" />
        </Link>
        <p className="mt-4 text-sm leading-7 text-[#d6c8e2]">{ar ? "دور على ماتش، احجز ملعب، أو اكتشف أكاديمية." : "Find a game, book a court, or explore an academy."}</p>
      </div>
      {sections.map(section => <nav key={section.en} aria-label={section[lang]}>
        <h2 className="mb-4 text-sm font-extrabold text-[#ccff00]">{section[lang]}</h2>
        <div className="grid gap-3">
          {section.links.map(link => <Link key={link.href} href={link.href} className="w-fit text-sm font-medium text-[#e2d5ed] transition-colors hover:text-[#ccff00] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ccff00]">{link[lang]}</Link>)}
        </div>
      </nav>)}
    </div>
    <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 border-t border-[#64417f]/40 px-5 py-5 text-xs text-[#bcaaca] sm:px-8">
      <span dir="ltr">© {new Date().getFullYear()} Playza</span>
      <Link href="/faq" className="inline-flex items-center gap-1.5 hover:text-[#ccff00]">{ar ? "محتاج مساعدة؟" : "Need help?"} <ArrowUpRight size={13} aria-hidden="true" /></Link>
    </div>
  </footer>;
}
