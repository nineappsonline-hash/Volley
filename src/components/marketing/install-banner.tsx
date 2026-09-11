"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AppLogo } from "@/components/shared/app-logo";
import styles from "./landing.module.css";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export function InstallBanner() {
  const { t, dir } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(
    null
  );
  const [iosModal, setIosModal] = useState(false);

  useEffect(() => {
    if (navigator.serviceWorker?.register)
      navigator.serviceWorker.register("/sw.js").catch(() => {});

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as DeferredPrompt);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  if (isStandalone()) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      setDeferredPrompt(null);
    } else if (isIOS()) {
      setIosModal(true);
    }
  };

  return (
    <>
      <section dir={dir} className={styles.installBanner}>
        <div className={styles.installBannerInner}>
          <div className={styles.installIcon}>
            <AppLogo className="w-12 h-auto" />
          </div>
          <div className={styles.installCopy}>
            <h3>{t("landing_install_title")}</h3>
            <p>{t("landing_install_desc")}</p>
          </div>
          <div className={styles.installActions}>
            <button
              className={styles.installCta}
              onClick={handleInstall}
              type="button"
            >
              <Smartphone size={18} />
              {t("landing_install_cta")}
            </button>
          </div>
        </div>
      </section>

      {iosModal && (
        <div
          className={styles.installModal}
          role="dialog"
          aria-modal="true"
          aria-label={t("landing_install_ios_title")}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIosModal(false);
          }}
        >
          <div className={styles.installSheet}>
            <h3>{t("landing_install_ios_title")}</h3>
            <div className={styles.installStep}>
              <span>1</span>
              <div>
                <Share size={18} />
                <p>{t("landing_install_ios_step1")}</p>
              </div>
            </div>
            <div className={styles.installStep}>
              <span>2</span>
              <p>{t("landing_install_ios_step2")}</p>
            </div>
            <button
              className={styles.installModalClose}
              onClick={() => setIosModal(false)}
              type="button"
            >
              {t("landing_install_ios_close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
