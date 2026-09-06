"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
  "BEl62iUYgUivxIkv69yViEuiBIaGnK1kCcz0BO8LD8kZ1uGiQ8m3q6byr7R6Q7W2x3SkOY6NS4fQnHkS4zKz2nI";

async function urlBase64ToUint8Array(base64String: string): Promise<Uint8Array> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Registers the push service worker and (optionally) subscribes the current
 * device, storing the subscription via the upsert_push_subscription RPC.
 * Returns helpers so the UI can toggle push on/off.
 */
export function usePushNotifications() {
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
  );
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        regRef.current = reg;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!sub);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    setBusy(true);
    try {
      if ("Notification" in window && Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        setPermission(p);
        if (p !== "granted") return false;
      }
      const reg =
        regRef.current ?? (await navigator.serviceWorker.register("/sw.js"));
      regRef.current = reg;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: (await urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY
        )) as unknown as BufferSource,
      });
      const json = sub.toJSON();
      const supabase = createClient();
      const { error } = await supabase.rpc("upsert_push_subscription", {
        p_endpoint: json.endpoint ?? "",
        p_p256dh: json.keys?.p256dh ?? "",
        p_auth: json.keys?.auth ?? "",
      });
      if (error) throw error;
      setSubscribed(true);
      return true;
    } catch (e) {
      console.error("push subscribe failed", e);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg =
        regRef.current ?? (await navigator.serviceWorker.getRegistration("/sw.js"));
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          const supabase = createClient();
          await supabase.rpc("remove_push_subscription", { p_endpoint: endpoint });
        }
      }
      setSubscribed(false);
    } catch (e) {
      console.error("push unsubscribe failed", e);
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, busy, subscribe, unsubscribe };
}
