"use client";
import { gameBookingPayment } from "@/lib/game-costs";
import { formatMoney } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

export function GameBookingStatus({ game }: { game: Parameters<typeof gameBookingPayment>[0] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const payment = gameBookingPayment(game);
  if (!payment || game.status === "cancelled") return null;
  return <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
    <p className="font-semibold">{payment.confirmed ? (ar ? "الحجز مؤكد" : "Booking confirmed") : (ar ? "في انتظار دفعة تأكيد الحجز (٥٠٪)" : "Awaiting 50% booking deposit")}</p>
    <p>{ar ? "المدفوع المعتمد: " : "Approved payment: "}{formatMoney(payment.paid, lang)} / {formatMoney(payment.total, lang)}</p>
    {payment.confirmed ? <p>{payment.remaining > 0
      ? (ar ? `المتبقي ${formatMoney(payment.remaining, lang)} — يمكن دفعه في الملعب.` : `Remaining ${formatMoney(payment.remaining, lang)} — payable at the premises.`)
      : (ar ? "تم سداد إيجار الملعب بالكامل." : "Court rent fully paid.")}</p>
      : <p>{ar ? `مطلوب ${formatMoney(payment.depositRemaining, lang)} لتأكيد الحجز. الباقي يمكن دفعه في الملعب.` : `${formatMoney(payment.depositRemaining, lang)} needed to confirm. The balance can be paid at the premises.`}</p>}
    {payment.pending > 0 && <p className="text-muted-foreground">{ar ? "إيصالات قيد المراجعة: " : "Receipts awaiting approval: "}{formatMoney(payment.pending, lang)}</p>}
  </div>;
}
