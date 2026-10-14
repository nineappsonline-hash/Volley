"use client";
import { useI18n } from "@/lib/i18n";
export function PlayerJoiningGuide({ skillLevel }: { skillLevel?: string | null }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return <div className="my-3 rounded-lg border bg-muted/30 p-3 text-sm">
    {skillLevel === "beginner" && <p className="font-semibold text-brand">{ar ? "المستوى المحدد من المنظم: مبتدئ" : "Organizer-listed level: beginner"}</p>}
    <p className="text-muted-foreground">{ar ? "يمكنك طلب الانضمام بحسابك الفردي. راجع شروط المنظم والمستوى والأماكن المتاحة؛ بعض المباريات لها قائمة انتظار." : "Request a place using your individual account. Check organizer requirements, level and availability; some games have a waitlist."}</p>
    <details className="mt-2"><summary className="cursor-pointer rounded font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{ar ? "قبل الحضور" : "Before you attend"}</summary><p className="mt-2 text-muted-foreground">{ar ? "راجع نقطة التجمع والميعاد وتأكيد الحجز والدفع. اسأل المنظم عن توفير الكرة والأدوات، والملابس أو الأحذية المناسبة للملعب، وكيفية توزيع الفرق. إنشاء الحساب لا يؤكد مكانك أو دفعك." : "Check the meeting point, start time, booking and payment confirmation. Ask the organizer about balls and equipment, suitable clothing or footwear for the surface, and how teams are assigned. Creating an account does not confirm your place or payment."}</p></details>
  </div>;
}
