"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";

export default function ProductPhotoPreviewDialog({
  src, alt, ar, open, onOpenChange,
}: {
  src: string;
  alt: string;
  ar: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 rounded-2xl p-4 sm:max-w-4xl" closeButtonClassName="flex h-9 w-9 items-center justify-center rounded-full border bg-card opacity-100">
        <DialogTitle className="pe-12 text-base leading-relaxed">{alt}</DialogTitle>
        <DialogDescription className="sr-only">
          {ar ? "صورة مكبرة للمنتج. اضغط إغلاق أو Escape للعودة." : "Enlarged product photo. Close or press Escape to return."}
        </DialogDescription>
        <Image src={src} alt={alt} width={1200} height={1200} unoptimized className="max-h-[65dvh] w-full rounded-xl bg-muted/30 object-contain" />
        <DialogClose asChild>
          <Button type="button" variant="outline" className="justify-self-end">
            {ar ? "إغلاق الصورة" : "Close photo"}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
