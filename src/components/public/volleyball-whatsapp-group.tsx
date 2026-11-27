import { MessageCircle, ArrowUpRight } from "lucide-react";

/** Official community invite supplied by the Playza organizer.
 * Always opens as a regular external link; joining is controlled by WhatsApp.
 */
export const NEW_CAIRO_VOLLEYBALL_WHATSAPP_URL =
  "https://chat.whatsapp.com/GKcRdTuQ7212BbIyeOYQko?s=cl&p=i&iam=2";

export function VolleyballWhatsAppGroup({
  lang = "ar",
  compact = false,
}: {
  lang?: "ar" | "en";
  compact?: boolean;
}) {
  const ar = lang === "ar";
  return (
    <aside
      aria-label={ar ? "جروب واتساب ماتشات الطائرة في التجمع" : "New Cairo volleyball WhatsApp group"}
      className={compact
        ? "rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4"
        : "rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6"}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-foreground sm:text-lg">
            {ar ? "تابع حجوزات الطايرة في التجمع الخامس" : "Follow volleyball games in Fifth Settlement"}
          </h2>
          {!compact && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {ar
                ? "انضم لجروب واتساب ماتشات الـVolleyball في التجمع الخامس عشان تتابع المواعيد والحجوزات الجديدة. تأكيد مكانك في أي ماتش بيكون من خلال تفاصيل الحجز على Playza."
                : "Join the Fifth Settlement volleyball WhatsApp group to follow new game announcements and bookings. Confirm your place in each match through Playza's booking details."}
            </p>
          )}
        </div>
        <a
          href={NEW_CAIRO_VOLLEYBALL_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ar ? "انضم لجروب واتساب ماتشات الطايرة في التجمع الخامس (يفتح واتساب في تبويب جديد)" : "Join the Fifth Settlement volleyball WhatsApp group (opens in a new tab)"}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#16803c] px-5 py-3 font-bold text-white shadow-sm transition-colors hover:bg-[#116630] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <MessageCircle size={19} aria-hidden="true" />
          {ar ? "انضم لجروب واتساب" : "Join WhatsApp Group"}
          <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}
