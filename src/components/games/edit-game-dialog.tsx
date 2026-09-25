"use client";

import { AdminGameEditor } from "./admin-game-editor";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Eye, EyeOff, ShieldAlert, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { formatTime12h } from "@/lib/constants";
import { useCancelFriendlyGame, useSetFriendlyGameVisibility, useUpdateFriendlyGameMaxPlayers } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";
import type { FriendlyGameWithDetails, Profile } from "@/lib/types";

type Props = {
  game: FriendlyGameWithDetails;
  profile: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditGameDialog({ game, profile, open, onOpenChange }: Props) {
  const { t, lang } = useI18n();
  const visibility = useSetFriendlyGameVisibility();
  const cancel = useCancelFriendlyGame();
  const updateMaxPlayers = useUpdateFriendlyGameMaxPlayers();
  const [adminEditorOpen, setAdminEditorOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(game.is_public);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [maxPlayersInput, setMaxPlayersInput] = useState(String(game.max_players));

  const isCreator = game.creator_id === profile.id;
  const isSuperAdmin = profile.role === "super_admin";
  const canEdit = isCreator || isSuperAdmin;

  // Another player has already committed to this game (confirmed, not waitlisted).
  const othersOptedIn = useMemo(
    () =>
      (game.participants ?? []).some(
        (p) =>
          p.member_id !== profile.id &&
          !p.is_waitlisted &&
          (p.pay_status === "pending" || p.pay_status === "approved")
      ),
    [game.participants, profile.id]
  );

  // Every committed seat counts against the cap, organizer included.
  const joinedCount = useMemo(
    () => (game.participants ?? []).filter((p) => !p.is_waitlisted).length,
    [game.participants]
  );

  const minMaxPlayers = Math.max(game.min_players ?? 2, 2, joinedCount);
  const maxPlayersValue = Number(maxPlayersInput);
  const maxPlayersInvalid =
    !Number.isInteger(maxPlayersValue) ||
    maxPlayersValue < 2 ||
    maxPlayersValue > 30 ||
    maxPlayersValue < minMaxPlayers;
  const maxPlayersChanged = maxPlayersValue !== game.max_players;

  // Super admins can always cancel; a creator can only cancel while they are the
  // only committed player. Otherwise the game auto-cancels + refunds at game time.
  const canCancelDirectly = isSuperAdmin || !othersOptedIn;

  useEffect(() => {
    if (open) {
      setIsPublic(game.is_public);
      setMaxPlayersInput(String(game.max_players));
    }
  }, [open, game.is_public, game.max_players]);

  if (!canEdit) return null;

  const handleVisibilityChange = (value: string) => {
    const next = value === "public";
    setIsPublic(next);
    visibility.mutate(
      { gameId: game.id, isPublic: next },
      {
        onSuccess: () => toast.success(t("games_visibility_saved")),
        onError: (err) => {
          setIsPublic(game.is_public);
          toast.error(errorMessage(err, t("common_error")));
        },
      }
    );
  };

  const handleCancel = async () => {
    setCancelConfirmOpen(false);
    try {
      await cancel.mutateAsync(game.id);
      toast.success(t("community_game_cancelled"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleSaveMaxPlayers = () => {
    updateMaxPlayers.mutate(
      { gameId: game.id, maxPlayers: maxPlayersValue },
      {
        onSuccess: () => toast.success(t("games_max_players_saved")),
        onError: (err) => toast.error(errorMessage(err, t("common_error"))),
      }
    );
  };

  const cancelled = game.status === "cancelled";
  const active = game.status === "open" || game.status === "full";

  return (
    <>
      {adminEditorOpen && <AdminGameEditor game={{ ...game }} onClose={() => setAdminEditorOpen(false)} />}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("games_edit_title")}</DialogTitle>
            <DialogDescription>
              {game.title}
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {game.game_date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime12h(game.start_time, lang)}
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {isSuperAdmin && <Button onClick={() => setAdminEditorOpen(true)}>{lang === "ar" ? "تعديل كل إعدادات المباراة" : "Edit all game settings"}</Button>}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {game.is_public ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {t("games_visibility")}
              </Label>
              <div className="flex items-center gap-3">
                <Select
                  value={isPublic ? "public" : "private"}
                  disabled={visibility.isPending}
                  onValueChange={handleVisibilityChange}
                >
                  <SelectTrigger className="w-40" aria-label={t("games_visibility")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">{t("games_public")}</SelectItem>
                    <SelectItem value="private">{t("games_private")}</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  {isPublic ? t("games_public") : t("games_private")}
                </Badge>
              </div>
            </div>

            {!cancelled && active && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t("community_max_players")}
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="2"
                    max="30"
                    dir="ltr"
                    value={maxPlayersInput}
                    onChange={(e) => setMaxPlayersInput(e.target.value)}
                    disabled={updateMaxPlayers.isPending}
                    className="max-w-[8rem]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveMaxPlayers}
                    disabled={
                      maxPlayersInvalid ||
                      !maxPlayersChanged ||
                      updateMaxPlayers.isPending
                    }
                  >
                    {updateMaxPlayers.isPending
                      ? t("common_saving")
                      : t("common_save")}
                  </Button>
                </div>
                {maxPlayersInvalid && (
                  <p className="text-xs text-destructive">
                    {t("games_max_players_hint").replace("{min}", String(minMaxPlayers))}
                  </p>
                )}
              </div>
            )}

            {!cancelled && active && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  {t("games_edit_cancel_heading")}
                </Label>
                {canCancelDirectly ? (
                  <>
                    <p className="text-xs text-muted-foreground">{t("games_edit_cancel_desc")}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={cancel.isPending}
                      onClick={() => setCancelConfirmOpen(true)}
                    >
                      {t("community_cancel")}
                    </Button>
                  </>
                ) : (
                  <p className="flex items-start gap-2 rounded-lg border border-attention-300/60 bg-attention-50 p-2.5 text-xs text-warning-ink dark:bg-attention-500/10">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    {t("games_edit_cancel_blocked")}
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("community_cancel_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("community_cancel_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleCancel()}
              disabled={cancel.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("community_cancel_confirm_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}