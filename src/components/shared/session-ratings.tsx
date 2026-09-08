"use client";

import { useSessionRatings, useSubmitRating } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Star } from "lucide-react";
import { useState } from "react";

export function SessionRatings({ sessionId, currentUserId }: { sessionId: string; currentUserId?: string }) {
  const { t: tk, lang } = useI18n();
  const t = (key: string) => tk(key as any);
  const { data: ratings = [] } = useSessionRatings(sessionId);
  const submitRating = useSubmitRating();

  const [myRating, setMyRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);

  const myExistingRating = ratings.find((r) => r.member_id === currentUserId);
  const avgRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : "—";

  const handleSubmit = async () => {
    if (!currentUserId || myRating === 0) return;
    await submitRating.mutateAsync({
      session_id: sessionId,
      member_id: currentUserId,
      rating: myRating,
      comment: comment || undefined,
    });
    toast.success(t("rate_submitted"));
    setComment("");
  };

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{t("rate_session")}</h4>
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          <Star className="h-4 w-4 fill-attention-400 text-attention-400" />
          <span>{avgRating}</span>
          <span>({ratings.length} {t("rate_reviews")})</span>
        </div>
      </div>

      {/* Star rating input */}
      {!myExistingRating && currentUserId && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("rate_your_experience")}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="focus:outline-none"
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setMyRating(star)}
              >
                <Star
                  className={`h-6 w-6 transition-colors ${
                    star <= (hoveredStar || myRating)
                      ? "fill-attention-400 text-attention-400"
                      : "text-neutral-300"
                  }`}
                />
              </button>
            ))}
            {myRating > 0 && (
              <span className="text-sm text-muted-foreground ml-2 self-center">
                {myRating}/5
              </span>
            )}
          </div>
          {myRating > 0 && (
            <>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("rate_comment_placeholder")}
                rows={2}
              />
              <Button size="sm" onClick={handleSubmit} disabled={submitRating.isPending}>
                {t("rate_submit")}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Existing ratings */}
      {ratings.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {ratings.map((rating) => (
            <div key={rating.id} className="flex items-start gap-2 text-sm">
              <div className="flex gap-0.5 shrink-0">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-3 w-3 ${s <= rating.rating ? "fill-attention-400 text-attention-400" : "text-neutral-200"}`}
                  />
                ))}
              </div>
              <span className="text-muted-foreground">
                {(rating as any).profile?.name}
                {rating.comment && ` — ${rating.comment}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
