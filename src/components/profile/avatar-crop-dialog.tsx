"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

export function AvatarCropDialog({ file, onClose, onSave, busy }: {
  file: File; onClose: () => void; onSave: (blob: Blob) => Promise<void>; busy: boolean;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const canvas = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [error, setError] = useState(false);
  const [encoding, setEncoding] = useState(false);
  const pending = busy || encoding;
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    let active = true;
    img.onload = () => { if (active) setPhoto(img); };
    img.onerror = () => { if (active) setError(true); };
    img.src = url;
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);
  useEffect(() => {
    if (!photo || !canvas.current) return;
    const context = canvas.current.getContext("2d");
    if (!context) { setError(true); return; }
    const side = Math.min(photo.naturalWidth, photo.naturalHeight) / zoom;
    const left = (photo.naturalWidth - side) * x / 100;
    const top = (photo.naturalHeight - side) * y / 100;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 512, 512);
    context.drawImage(photo, left, top, side, side, 0, 0, 512, 512);
  }, [photo, zoom, x, y]);
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>{ar ? "قص صورة الملف الشخصي" : "Crop profile picture"}</DialogTitle><DialogDescription>{ar ? "كبّر الصورة واضبط موضعها قبل الحفظ." : "Zoom and adjust the position before saving."}</DialogDescription></DialogHeader>
      {error ? <p role="alert" className="text-destructive">{ar ? "تعذر فتح الصورة. اختار صورة JPG أو PNG أو WebP." : "Could not read this image. Choose a JPG, PNG, or WebP photo."}</p> : <>
        <div className="relative mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-lg border bg-muted">
          <canvas ref={canvas} width={512} height={512} className="h-full w-full" aria-label={ar ? "معاينة الصورة" : "Cropped picture preview"} />
          <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80" />
        </div>
        {!photo && <p role="status">{ar ? "جارٍ تحميل الصورة…" : "Loading image…"}</p>}
        <fieldset disabled={pending || !photo} className="space-y-3">
          {([
            [ar ? "التكبير" : "Zoom", zoom, setZoom, 1, 3, 0.01],
            [ar ? "الموضع الأفقي" : "Horizontal position", x, setX, 0, 100, 1],
            [ar ? "الموضع الرأسي" : "Vertical position", y, setY, 0, 100, 1],
          ] as const).map(([label, value, set, min, max, step]) => <label key={label} className="block text-sm font-medium">{label}<input className="mt-2 block w-full" type="range" min={min} max={max} step={step} value={value} onChange={event => set(Number(event.target.value))} /></label>)}
        </fieldset>
      </>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={pending} onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
        <Button disabled={pending || !photo || error} onClick={async () => {
          if (!canvas.current || pending) return;
          setEncoding(true);
          try {
            const blob = await new Promise<Blob | null>(resolve => canvas.current!.toBlob(resolve, "image/jpeg", 0.9));
            if (!blob) { setError(true); return; }
            await onSave(blob);
          } catch { setError(true); }
          finally { setEncoding(false); }
        }}>{pending ? (ar ? "بنحفظ…" : "Saving…") : (ar ? "حفظ الصورة" : "Save photo")}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
