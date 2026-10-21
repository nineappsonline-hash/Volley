import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";

export const academyManagementPath = (lang: "en" | "ar") => `${lang === "ar" ? "/ar" : ""}/academy-management`;
export const ACADEMY_MANAGEMENT = {
  en: {
    title: "Sports Academy Management Software in Egypt",
    description: "Manage your sports academy with Playza: player subscriptions, training schedules, QR attendance, payment records and session finances in Arabic and English.",
    eyebrow: "FOR ACADEMY OWNERS AND COACHES",
    heading: "More time coaching. Less time managing spreadsheets.",
    intro: "Playza is a web application for managing sports academies in Egypt. Bring player records, subscription sessions, training schedules, attendance and financial reporting together in one Arabic and English workspace.",
    cta: "Register your academy", home: "Home", switch: "العربية", featuresTitle: "One workspace for everyday academy operations",
    features: [
      ["Players and subscriptions", "Keep member records, manage subscription plans and review paid and remaining sessions."],
      ["Training schedules", "Organize academy training sessions and give members access to their upcoming schedule."],
      ["Attendance and QR check-in", "Record session attendance and use QR check-in to connect participation with member records."],
      ["Payments and session finances", "Record member payments, track session costs and review calculated profit and loss."],
      ["Reports", "Review attendance and financial records to understand the academy’s day-to-day activity."],
      ["Member experience", "Members can view upcoming training, attendance history and subscription information through their account."],
    ],
    workflowTitle: "How to organize your academy with Playza",
    workflow: ["Register an academy account and configure your academy details.", "Add members and subscription plans, then organize training sessions.", "Record attendance and payments as sessions take place.", "Review reports and session costs to support your operational decisions."],
    fitTitle: "Built for sports academies, with Arabic and English support",
    fit: "Explore workflows for volleyball, football, basketball, padel and swimming academies. The responsive web interface supports Arabic RTL and English LTR on desktop and mobile. Available tools depend on account permissions and subscription access.",
    solutions: "Explore sport-specific solutions", faqTitle: "Academy management questions",
    faqs: [
      ["What is sports academy management software?", "It brings player records, subscriptions, training schedules, attendance and financial records into one system. Playza combines these tools for sports academy administrators, coaches and members."],
      ["Can I manage subscription sessions and attendance?", "Yes. Playza includes member subscription plans, paid and remaining sessions, attendance records and QR check-in tools."],
      ["Does Playza support Arabic in Egypt?", "Yes. Playza supports Arabic with right-to-left layouts and English with left-to-right layouts. It runs in a web browser on desktop and mobile."],
      ["Does academy software replace booking or payment confirmation?", "No. A payment record, public listing or schedule does not by itself confirm a booking. Check the relevant booking and payment status. Academy subscriptions and individual activity fees are separate."],
      ["How do I start, and where can I check pricing?", "Register an academy account to begin setup. Review the available plans and terms in the account before subscribing; this guide does not quote an unverified price or promise a specific trial."],
    ],
  },
  ar: {
    title: "برنامج إدارة الأكاديميات الرياضية في مصر",
    description: "نظّم أكاديميتك الرياضية مع بلايزا: اشتراكات اللاعبين، جداول التدريب، الحضور عبر QR، سجلات المدفوعات وتقارير الجلسات بالعربية والإنجليزية.",
    eyebrow: "لأصحاب الأكاديميات والمدربين",
    heading: "وقت أكثر للتدريب. ومجهود أقل في الإدارة.",
    intro: "بلايزا تطبيق ويب لإدارة الأكاديميات الرياضية في مصر. اجمع بيانات اللاعبين واشتراكاتهم وجداول التدريب والحضور والتقارير المالية في مساحة عمل واحدة بالعربية والإنجليزية.",
    cta: "سجّل أكاديميتك", home: "الرئيسية", switch: "English", featuresTitle: "مساحة واحدة لإدارة العمل اليومي للأكاديمية",
    features: [
      ["اللاعبون والاشتراكات", "احتفظ ببيانات الأعضاء، وأدر خطط الاشتراك، وراجع الجلسات المدفوعة والمتبقية."],
      ["جداول التدريب", "نظّم جلسات تدريب الأكاديمية وأتح للأعضاء الاطلاع على مواعيدهم الجاية."],
      ["الحضور وتسجيل الدخول عبر QR", "سجّل حضور الجلسات واستخدم رموز QR لربط المشاركة بسجلات الأعضاء."],
      ["المدفوعات ومالية الجلسات", "سجّل مدفوعات الأعضاء، وتابع تكاليف الجلسات، وراجع حسابات الربح والخسارة."],
      ["التقارير", "راجع سجلات الحضور والمالية لفهم النشاط اليومي للأكاديمية."],
      ["تجربة الأعضاء", "يمكن للأعضاء الاطلاع على التدريب الجاي وسجل الحضور وبيانات الاشتراك من حساباتهم."],
    ],
    workflowTitle: "كيف تنظّم أكاديميتك باستخدام بلايزا؟",
    workflow: ["سجّل حساب أكاديمية وأكمل بياناتها.", "أضف الأعضاء وخطط الاشتراك ونظّم جلسات التدريب.", "سجّل الحضور والمدفوعات مع انعقاد الجلسات.", "راجع التقارير وتكاليف الجلسات لدعم قراراتك التشغيلية."],
    fitTitle: "للأكاديميات الرياضية، بدعم العربية والإنجليزية",
    fit: "اكتشف حلول إدارة أكاديميات الكرة الطائرة وكرة القدم وكرة السلة والبادل والسباحة. واجهة الويب متجاوبة مع الهاتف والكمبيوتر وتدعم اتجاه الكتابة العربي والإنجليزي. الأدوات المتاحة تعتمد على صلاحيات الحساب والاشتراك.",
    solutions: "اكتشف الحلول حسب الرياضة", faqTitle: "أسئلة عن إدارة الأكاديميات",
    faqs: [
      ["ما هو برنامج إدارة الأكاديميات الرياضية؟", "نظام يجمع بيانات اللاعبين والاشتراكات وجداول التدريب والحضور والسجلات المالية. يوفّر بلايزا هذه الأدوات لمسؤولي الأكاديميات الرياضية والمدربين والأعضاء."],
      ["هل يمكن متابعة جلسات الاشتراك والحضور؟", "نعم. يشمل بلايزا خطط اشتراك الأعضاء والجلسات المدفوعة والمتبقية وسجلات الحضور وأدوات تسجيل الحضور عبر QR."],
      ["هل يدعم بلايزا اللغة العربية في مصر؟", "نعم. يدعم بلايزا العربية من اليمين إلى اليسار والإنجليزية من اليسار إلى اليمين، ويعمل عبر متصفح الويب على الهاتف والكمبيوتر."],
      ["هل سجلات الإدارة تعني تأكيد الحجز أو الدفع؟", "لا. سجل الدفع أو الإعلان العام أو الجدول لا يؤكد الحجز بمفرده. راجع حالة الحجز والدفع الخاصة به. اشتراكات الأكاديمية منفصلة عن رسوم الأنشطة الفردية."],
      ["كيف أبدأ وأين أراجع الأسعار؟", "سجّل حساب أكاديمية لبدء الإعداد، وراجع الخطط والشروط المتاحة داخل الحساب قبل الاشتراك. هذا الدليل لا يعرض سعراً غير مؤكّد ولا يعد بفترة تجريبية محددة."],
    ],
  },
} as const;

export function academyManagementMetadata(lang: "en" | "ar"): Metadata {
  const c = ACADEMY_MANAGEMENT[lang];
  return {
    title: c.title, description: c.description,
    keywords: ["sports academy management software Egypt", "academy management app", "player subscription management", "sports academy attendance", "برنامج إدارة الأكاديميات الرياضية", "إدارة أكاديمية رياضية مصر", "إدارة اشتراكات اللاعبين", "برنامج حضور الأكاديميات"],
    alternates: { canonical: academyManagementPath(lang), languages: { en: academyManagementPath("en"), "ar-EG": academyManagementPath("ar"), "x-default": academyManagementPath("en") } },
    openGraph: { title: `${c.title} | Playza`, description: c.description, url: `${SITE_URL}${academyManagementPath(lang)}`, type: "website", siteName: "Playza", locale: lang === "ar" ? "ar_EG" : "en_US", alternateLocale: [lang === "ar" ? "en_US" : "ar_EG"], images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: c.title, description: c.description, images: [OG_IMAGE] },
  };
}
