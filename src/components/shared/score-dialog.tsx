"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useSubmitGameScore } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameId: string;
  gameTitle: string;
};

export function ScoreDialog({ open, onOpenChange, gameId, gameTitle }: Props) {
  const { t } = useI18n();
  const submit = useSubmitGameScore();
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const handleSubmit = async () => {
    const sa = Number(a);
    const sb = Number(b);
    if (!Number.isInteger(sa) || !Number.isInteger(sb) || sa < 0 || sb < 0) {
      return;
    }
    try {
      await submit.mutateAsync({ gameId, resultA: sa, resultB: sb });
      toast.success(t("score_submitted"));
      onOpenChange(false);
      setA("");
      setB("");
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning-ink" />
            {t("score_title")}
          </DialogTitle>
          <DialogDescription>
            {t("score_desc").replace("{title}", gameTitle)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="w-20">
            <Input
              type="number"
              min="0"
              dir="ltr"
              className="text-center"
              inputMode="numeric"
              value={a}
              onChange={(e) => setA(e.target.value)}
              aria-label={t("score_home")}
              placeholder="0"
            />
          </div>
          <span className="text-lg font-semibold text-muted-foreground">–</span>
          <div className="w-20">
            <Input
              type="number"
              min="0"
              dir="ltr"
              className="text-center"
              inputMode="numeric"
              value={b}
              onChange={(e) => setB(e.target.value)}
              aria-label={t("score_away")}
              placeholder="0"
            />
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {t("score_organizer_only")}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submit.isPending ||
              !Number.isInteger(Number(a)) ||
              !Number.isInteger(Number(b))
            }
          >
            {submit.isPending ? t("common_saving") : t("score_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}