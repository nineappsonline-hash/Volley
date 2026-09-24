"use client";

import Image from "next/image";
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
            className="flex h-14 w-14 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Image
              src="/favicon.png"
              alt=""
              width={64}
              height={64}
              unoptimized
              className="h-full w-full object-contain"
            />
          </button>
        }
      />
    </div>
  );
}