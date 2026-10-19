"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, ClipboardCheck, Users, TrendingUp, Wallet, Volleyball, Building2, QrCode } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MemberHomeHeader } from "./member-home-header";
import styles from "./dashboard.module.css";

export function DashboardNavigation({ admin = false, hasQr = false, sections, name }: { name?: string; admin?: boolean; hasQr?: boolean; sections?: { id: string; label: string }[] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const actions = admin ? [
    { href: "/academy", icon: Building2, title: ar ? "إدارة الأكاديمية" : "Academy workspace", hint: ar ? "مجموعات وحجوزات وأعضاء وماليات" : "Groups, bookings, members and finance" },
    { href: "/attendance", icon: ClipboardCheck, title: ar ? "سجّل الحضور" : "Take attendance", hint: ar ? "الماسح وقائمة اللاعبين" : "Scanner and player roster" },
    { href: "/members", icon: Users, title: ar ? "إدارة الأعضاء" : "Manage members", hint: ar ? "بيانات، اشتراكات ومدفوعات" : "Profiles, plans and payments" },
    { href: "/schedule", icon: CalendarDays, title: ar ? "جدول التدريب" : "Training schedule", hint: ar ? "نظّم المواعيد والحصص" : "Organize sessions and times" },
    { href: "/reports", icon: Wallet, title: ar ? "التقارير المالية" : "Financial reports", hint: ar ? "راجع الإيرادات والمصروفات" : "Review income and expenses" },
  ] : [
    { href: hasQr ? "#checkin" : "/academies", icon: hasQr ? QrCode : Building2, title: hasQr ? (ar ? "كود الحضور" : "Attendance QR") : (ar ? "اكتشف أكاديمية" : "Find an academy"), hint: ar ? "خطوتك الجاية في التدريب" : "Your next training step" },
    { href: "/parent", icon: Users, title: ar ? "لوحة عيلتي" : "My family", hint: ar ? "تابع ولادك من مكان واحد" : "Follow your children in one place" },
    { href: "/profile#evaluations", icon: TrendingUp, title: ar ? "تقييمي وتطوري" : "Feedback & progress", hint: ar ? "ملاحظات المدرب وتقييمات الأداء" : "Coach feedback and evaluations" },
    { href: "/dashboard/games", icon: Volleyball, title: ar ? "لاقي ماتش" : "Find a game", hint: ar ? "العب واتعرف على لاعبين" : "Play and meet other players" },
  ];
  // Default chips mirror each dashboard's real sections; callers that render a
  // different layout pass `sections` explicitly.
  const chips = sections ?? (admin
    ? [
        { id: "overview", label: ar ? "نظرة عامة" : "Overview" },
        { id: "training", label: ar ? "التدريب والمتابعة" : "Training & activity" },
        { id: "updates", label: ar ? "الأخبار والتنبيهات" : "Updates" },
      ]
    : [
        { id: "overview", label: ar ? "نظرة عامة" : "Overview" },
        { id: "training", label: ar ? "التدريب والمتابعة" : "Training & activity" },
        { id: "tournaments", label: ar ? "بطولاتي" : "Tournaments" },
        { id: "updates", label: ar ? "الأخبار والتنبيهات" : "Updates" },
      ]);
  if (!admin) return <MemberHomeHeader name={name} hasQr={hasQr} sections={chips} />;
  return <div className={styles.intro}>
    <div className={styles.introTop}><div><span className={styles.eyebrow}>{ar ? "خطوتك الجاية" : "Your next step"}</span><h2>{admin ? (ar ? "إدارة أوضح. يوم أسهل." : "Clearer management. A smoother day.") : (ar ? "جاهز لتمرينتك الجاية؟" : "Ready for your next session?")}</h2><p>{admin ? (ar ? "ابدأ بالمهمة اللي محتاجها، وتابع باقي أكاديميتك من الأقسام تحت." : "Start with a task, then explore your academy overview below.") : (ar ? "حضورك، تطورك، وعيلتك… كل حاجة قريبة منك." : "Your attendance, progress and family, all within reach.")}</p></div><CalendarDays className={styles.heroIcon} aria-hidden="true" /></div>
    <nav className={styles.actions} aria-label={ar ? "إجراءات سريعة" : "Quick actions"}>{actions.map(({href, icon: Icon, title, hint}) => <Link key={href} href={href} className={styles.action}><span className={styles.actionIcon}><Icon size={22} /></span><span><strong>{title}</strong><small>{hint}</small></span><ArrowUpRight size={16} className={styles.arrow} aria-hidden="true" /></Link>)}</nav>
    <nav className={styles.sections} aria-label={ar ? "أقسام لوحة التحكم" : "Dashboard sections"}>{chips.map(({ id, label }) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
  </div>;
}

export function DashboardSection({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-title`} className={styles.section}><header className={styles.sectionHeader}><h2 id={`${id}-title`}>{title}</h2>{hint && <p>{hint}</p>}</header>{children}</section>;
}
