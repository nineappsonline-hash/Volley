"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { PUSH_PROMPT_EVENT, usePushNotifications } from "@/lib/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const DISMISS_KEY = "push_prompt_dismissed_at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // re-ask after a week

/**
 * Asks the user to enable Web Push so that game invites, results and
 * announcements reach their phone even when the app is closed.
 *
 * Two modes:
 *  - Auto (default): appears on first visit and again after a natural action
 *    (e.g. joining a game, via PUSH_PROMPT_EVENT) if they haven't decided yet.
 *  - Controlled: pass `open` + `onOpenChange` to show it at a specific moment
 *    (e.g. right after registration). If push can't be asked for (unsupported,
 *    missing VAPID key, already subscribed or permission denied) it closes
 *    itself via `onOpenChange(false)` so the caller can continue.
 *
 * When permission is already granted but there's no subscription, it re-
 * subscribes silently — covers returning users who never finished the toggle.
 */
export function PushPrompt({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const { t } = useI18n();
  const push = usePushNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isControlled = controlledOpen !== undefined;

  const silentResubscribe = useCallback(async () => {
    if (!push.supported || push.subscribed || push.sessionChecked) return;
    if ("Notification" in window && Notification.permission === "granted") {
      await push.subscribe();
    }
  }, [push]);

  const canAsk = useCallback(() => {
    if (!push.supported || !VAPID_PUBLIC_KEY) return false;
    if (push.subscribed) return false;
    const permission =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "denied";
    return permission === "default"; // granted handled silently, denied is blocked
  }, [push.supported, push.subscribed]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  // Controlled mode: open when the parent asks for it, otherwise bail out so
  // the caller can proceed (e.g. navigation after registration).
  useEffect(() => {
    if (!isControlled || controlledOpen !== true) return;
    if (canAsk()) {
      setOpen(true);
    } else {
      onOpenChange?.(false);
    }
  }, [isControlled, controlledOpen, canAsk, onOpenChange]);

  const close = useCallback(
    (giveUp: boolean) => {
      if (giveUp) dismiss();
      setOpen(false);
      onOpenChange?.(false);
    },
    [dismiss, onOpenChange]
  );

  // Auto mode: not used when a parent drives the dialog.
  const maybeShow = useCallback(() => {
    if (isControlled) return;
    if (!canAsk()) return;
    try {
      const last = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (last && Date.now() - last < DISMISS_MS) return;
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, [isControlled, canAsk]);

  useEffect(() => {
    const onPrompt = () => maybeShow();
    window.addEventListener(PUSH_PROMPT_EVENT, onPrompt);
    const waited = window.setTimeout(maybeShow, 2500);
    return () => {
      window.removeEventListener(PUSH_PROMPT_EVENT, onPrompt);
      window.clearTimeout(waited);
    };
  }, [maybeShow]);

  useEffect(() => {
    if (!push.supported) return;
    void silentResubscribe();
  }, [push.supported, silentResubscribe, push.subscribed]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const ok = await push.subscribe();
      if (ok) {
        toast.success(t("push_prompt_done"));
        close(false);
      } else {
        close(true);
        toast.error(t("push_prompt_denied"));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLater = () => close(true);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleLater())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            {t("push_prompt_title")}
          </DialogTitle>
          <DialogDescription>{t("push_prompt_desc")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button onClick={handleEnable} disabled={busy} className="gap-1">
            <BellRing className="h-4 w-4" />
            {busy ? t("common_saving") : t("push_prompt_enable")}
          </Button>
          <Button variant="outline" onClick={handleLater} disabled={busy}>
            {t("push_prompt_later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}