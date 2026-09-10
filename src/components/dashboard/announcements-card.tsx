"use client";

import { format } from "date-fns";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
  useAnnouncements,
  useDeleteAnnouncement,
  useSaveAnnouncement,
} from "@/lib/queries";
import type { Announcement } from "@/lib/types";

interface AnnouncementsCardProps {
  isAdmin: boolean;
}

export function AnnouncementsCard({ isAdmin }: AnnouncementsCardProps) {
  const { t, locale } = useI18n();
  const announcementsQuery = useAnnouncements();
  const { data: announcements, isPending, isError, refetch } = announcementsQuery;
  const save = useSaveAnnouncement();
  const remove = useDeleteAnnouncement();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setDialogOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setTitle(a.title);
    setBody(a.body ?? "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    try {
      await save.mutateAsync({
        id: editing?.id,
        title: title.trim(),
        body: body.trim(),
      });
      toast.success(t("ann_saved"));
      setDialogOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success(t("ann_deleted"));
      setConfirmDeleteId(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-4 w-4 text-primary" />
          {t("ann_title")}
        </CardTitle>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="h-4 w-4" />
            {t("ann_add")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">
            <p className="text-muted-foreground">{t("common_error")}</p>
            <Button className="mt-2 h-7 px-2 text-xs" variant="outline" onClick={() => refetch()}>
              {t("common_retry")}
            </Button>
          </div>
        ) : !announcements || announcements.length === 0 ? (
          <EmptyState message={t("ann_empty")} icon={Megaphone} />
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  {a.body && (
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {a.body}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "MMM d, yyyy", { locale })}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label={t("common_edit")}
                      onClick={() => openEdit(a)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {confirmDeleteId === a.id ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-2 text-xs"
                        disabled={remove.isPending}
                        onClick={() => handleDelete(a.id)}
                      >
                        {t("common_confirm")}
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        onClick={() => setConfirmDeleteId(a.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("ann_edit") : t("ann_create")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">{t("ann_title_label")}</Label>
              <Input
                id="ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-body">{t("ann_body")}</Label>
              <Textarea
                id="ann-body"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common_cancel")}
            </Button>
            <Button disabled={!title.trim() || save.isPending} onClick={handleSave}>
              {save.isPending ? t("common_saving") : t("common_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
