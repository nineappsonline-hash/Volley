"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useReviewParticipantShare } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ParticipantPayment({ participantId, name, receiptPath, status }: {
  participantId: string; name: string; receiptPath: string | null; status: string;
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const review = useReviewParticipantShare();
  const cache = useQueryClient();
  const receipt = useQuery({
    queryKey: ["admin-participant-receipt", participantId, receiptPath],
    enabled: !!receiptPath,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await createClient().storage.from("game-fee-receipts").createSignedUrl(receiptPath!, 600);
      if (error) throw error;
      setImageFailed(false);
      return data.signedUrl;
    },
  });
  const label = ar ? "عرض إيصال الدفع" : "View payment receipt";
  return <div className="flex flex-wrap items-center gap-2">
    {!receiptPath ? <span className="text-xs text-muted-foreground">{ar ? "لا يوجد إيصال" : "No receipt"}</span> :
      receipt.isError ? <Button size="sm" variant="outline" onClick={() => void receipt.refetch()}>{ar ? "إعادة تحميل الإيصال" : "Retry receipt"}</Button> :
      !receipt.data ? <span role="status" className="text-xs text-muted-foreground">{ar ? "جارٍ تحميل الإيصال…" : "Loading receipt…"}</span> :
      <Button variant="outline" className="h-auto p-1" aria-label={`${label}: ${name}`} onClick={() => setExpanded(true)}>
        {imageFailed ? label : <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={receipt.data} alt={label} className="h-16 w-16 rounded object-contain" onError={() => setImageFailed(true)} />
        </>}
      </Button>}
    {status === "pending" && receiptPath && <Button size="sm" disabled={review.isPending} onClick={async () => {
      try {
        await review.mutateAsync({ participantId, approve: true });
        await cache.invalidateQueries({ queryKey: ["platform-records"] });
        toast.success(t("super_admin_fee_approved"));
      } catch (error) {
        toast.error(error && typeof error === "object" && "message" in error ? String(error.message) : t("common_error"));
      }
    }}>{review.isPending ? (ar ? "جارٍ الاعتماد…" : "Approving…") : (ar ? "اعتماد الدفع" : "Approve payment")}</Button>}
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>{name}</DialogDescription></DialogHeader>
        {receipt.data && <>
          {!imageFailed && <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receipt.data} alt={`${label}: ${name}`} className="max-h-[70vh] w-full object-contain" onError={() => setImageFailed(true)} />
          </>}
          <a className="text-sm text-info-ink underline" href={receipt.data} target="_blank" rel="noopener noreferrer">{ar ? "فتح الإيصال بالحجم الكامل" : "Open full-size receipt"}</a>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
