"use client";

import { useState } from "react";
import { Save, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export interface RatingSubmit {
  rating: number;
  comment?: string;
}

/**
 * Compact 1–5 star rating with an optional comment field. Submitting a star
 * persists immediately (with any typed comment); the comment field can also
 * be saved on its own once a rating exists.
 */
export function RatingControl({
  initialRating = 0,
  initialComment = "",
  onSubmit,
  size = "h-5 w-5",
  idleLabel,
}: {
  initialRating?: number;
  initialComment?: string;
  onSubmit: (payload: RatingSubmit) => Promise<void>;
  size?: string;
  idleLabel?: string;
}) {
  const { t: tk } = useI18n();
  const t = (key: string) => tk(key as any);
  const [selected, setSelected] = useState(initialRating);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);

  const pick = async (star: number) => {
    if (star === selected) return;
    setSelected(star);
    setSaving(true);
    try {
      await onSubmit({ rating: star, comment: comment.trim() || undefined });
      setComment("");
    } catch {
      // The parent surfaces the error (toast); nothing to do here.
      setSelected(initialRating);
    } finally {
      setSaving(false);
    }
  };

  const saveComment = async () => {
    if (selected <= 0) return;
    setSaving(true);
    try {
      await onSubmit({ rating: selected, comment: comment.trim() || undefined });
      setComment("");
    } catch {
      // The parent surfaces the error (toast); nothing to do here.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={saving}
            aria-label={t("rate_stars").replace("{n}", String(star))}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => pick(star)}
            className="transition-transform hover:scale-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              className={`${size} ${
                star <= (hovered || selected)
                  ? "fill-attention-400 text-attention-400"
                  : "text-muted-foreground/40"
              }`}
            />
          </button>
        ))}
        <span className="text-xs text-muted-foreground">
          {selected > 0 ? `${selected}/5` : idleLabel ?? t("directory_no_rating")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("rate_comment_placeholder")}
          className="h-9 flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={selected <= 0 || saving}
          onClick={saveComment}
        >
          <Save className="h-4 w-4" />
          {t("common_save")}
        </Button>
      </div>
    </div>
  );
}