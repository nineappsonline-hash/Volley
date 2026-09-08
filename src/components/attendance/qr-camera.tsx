"use client";

import { useEffect, useRef } from "react";

export function QrCamera({ onScan, onError, label }: {
  onScan: (code: string) => void;
  onError: () => void;
  label: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onScan, onError });
  callbacks.current = { onScan, onError };

  useEffect(() => {
    let cancelled = false;
    let detected = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    const stop = () => {
      controls?.stop();
      stream?.getTracks().forEach(track => track.stop());
    };
    const start = async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false, video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) { stop(); return; }
        controls = await new BrowserQRCodeReader().decodeFromStream(stream, video.current!, result => {
          if (!result || cancelled || detected) return;
          detected = true;
          callbacks.current.onScan(result.getText());
        });
        if (cancelled || detected) stop();
      } catch {
        stop();
        if (!cancelled) callbacks.current.onError();
      }
    };
    void start();
    return () => { cancelled = true; stop(); };
  }, []);

  return <video ref={video} muted autoPlay playsInline aria-label={label}
    className="aspect-square max-h-80 w-full rounded-lg bg-brand object-cover" />;
}
