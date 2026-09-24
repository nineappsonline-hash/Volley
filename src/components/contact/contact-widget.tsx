"use client";

import { MessageCircle } from "lucide-react";
import { ContactFormDialog } from "@/components/contact/contact-form-dialog";
import { useI18n } from "@/lib/i18n";

/** Floating contact button shown on every page. */
export function ContactWidget() {
  const { t } = useI18n();

  return (
    <div className="fixed bottom-5 end-5 z-40 pb-[env(safe-area-inset-bottom)]">
      <ContactFormDialog
        trigger={
          <button
            type="button"
            aria-label={t("contact_widget_label")}
            title={t("contact_widget_label")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        }
      />
    </div>
  );
}