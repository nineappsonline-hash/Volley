"use client";

import { useEffect, useState } from "react";
import { X, Share, Smartphone } from "lucide-react";
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

const DISMISS_KEY = "playza_install_dismissed";

export function InstallBanner() {
  const { t, dir } = useI18n();
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(
    null
  );
  const [iosModal, setIosModal] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (navigator.serviceWorker?.register)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (localStorage.getItem(DISMISS_KEY)) return;
    setVisible(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as DeferredPrompt);
    };

    const onInstalled = () => setVisible(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setVisible(false);
      setDeferredPrompt(null);
    } else if (isIOS()) {
      setIosModal(true);
    }
  };

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
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
            <button
              className={styles.installDismiss}
              onClick={dismiss}
              type="button"
              aria-label={t("landing_install_dismiss")}
            >
              <X size={18} />
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
