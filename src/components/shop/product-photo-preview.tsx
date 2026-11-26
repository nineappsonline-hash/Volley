"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ZoomIn } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import styles from "./shop.module.css";

const ProductPhotoPreviewDialog = dynamic(
  () => import("./product-photo-preview-dialog"),
  { ssr: false },
);

export function ProductPhotoPreview({
  src, alt, children, onOpenChange,
}: {
  src: string;
  alt: string;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const { lang } = useI18n();
  const ar = lang === "ar";
  const updateOpen = (value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
  };

  return (
    <>
      <button
        type="button"
        className={styles.photoPreview}
        aria-label={ar ? `تكبير صورة ${alt}` : `Enlarge photo of ${alt}`}
        aria-haspopup="dialog"
        onClick={() => updateOpen(true)}
      >
        {children}
        <span className={styles.zoomHint} aria-hidden="true">
          <ZoomIn size={15} />{ar ? "تكبير" : "Enlarge"}
        </span>
      </button>
      {open && (
        <ProductPhotoPreviewDialog
          src={src}
          alt={alt}
          ar={ar}
          open={open}
          onOpenChange={updateOpen}
        />
      )}
    </>
  );
}
