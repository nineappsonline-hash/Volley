"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// The contact form (react-hook-form, Zod, Radix Dialog) is only needed when
// somebody opens it. Keep the floating trigger available immediately.
const ContactFormDialog = dynamic(
  () => import("@/components/contact/contact-form-dialog").then(mod => mod.ContactFormDialog),
  { ssr: false }
);

export function ContactWidget() {
  const { t } = useI18n();
  const [opened, setOpened] = useState(false);

  return (
    <div className="contact-widget fixed bottom-5 end-5 z-40 pb-[env(safe-area-inset-bottom)]">
      <button
        type="button"
        aria-label={t("contact_widget_label")}
        title={t("contact_widget_label")}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={() => setOpened(true)}
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      {opened && <ContactFormDialog initialOpen />}
    </div>
  );
}
