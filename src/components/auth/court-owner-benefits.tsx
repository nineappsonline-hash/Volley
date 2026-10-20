"use client";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function CourtOwnerBenefits({ registrationLink = true }: { registrationLink?: boolean }) {
  const { lang } = useI18n(); const ar = lang === "ar";
  const benefits = ar ? [
    ["تسجيل ملاعبك مجانًا ١٠٠٪", "لا رسوم تسجيل أو إضافة ملاعب."],
    ["بدون عمولة", "تحصل على ١٠٠٪ من سعر الإيجار الذي تحدده، دون خصومات."],
    ["حجوزات مدفوعة مقدمًا", "لا يتأكد الحجز إلا بعد سداد قيمته بالكامل واعتماد الدفع؛ لتقليل الحجوزات الوهمية وعدم الحضور."],
    ["مستحقاتك في يوم الحجز", "يسدد فريق بلايزا قيمة الإيجار كاملة في تاريخ الحجز، ويمكنك متابعة حالة الصرف في حسابك."],
  ] : [
    ["100% FREE court registration", "No registration fees or charges for adding your courts."],
    ["ZERO commission", "Receive 100% of the rental price you set, with no deductions."],
    ["Fully prepaid bookings", "Bookings are confirmed only after full payment is approved, reducing unpaid reservations and no-shows."],
    ["Paid on the booking date", "Playza pays your full rental amount on the scheduled booking date. Track each payout in your account."],
  ];
  return <section className="space-y-4 rounded-2xl border border-secondary/20 bg-accent/40 p-4 sm:p-5" aria-label={ar ? "لأصحاب الملاعب" : "For court owners"}>
    {registrationLink ? <Button asChild className="h-auto w-full whitespace-normal px-4 py-4 text-center text-base font-extrabold"><Link href="/signup/owner">{ar ? "عندك ملعب رياضي؟ أضفه على بلايزا مجانًا!" : "Own a Sports Court? List It on Playza for FREE!"}</Link></Button> : <h2 className="text-xl font-extrabold text-secondary">{ar ? "ملعبك على بلايزا، مجانًا وبدون عمولة" : "Your courts on Playza. Free listing. Zero commission."}</h2>}
    <ul className="grid gap-4 sm:grid-cols-2">{benefits.map(([title, description]) => <li key={title} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary"/><div><p className="text-sm font-bold">{title}</p><p className="text-xs leading-relaxed text-muted-foreground">{description}</p></div></li>)}</ul>
  </section>;
}
