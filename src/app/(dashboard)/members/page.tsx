"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { MemberTable, type MemberRow } from "@/components/members/member-table";
import { MemberFormDialog } from "@/components/members/member-form-dialog";
import { useI18n } from "@/lib/i18n";
import { memberPerSessionValue, usedSessionsSincePayment } from "@/lib/calculations";
import {
  useAllPayments,
  useAttendance,
  useDeleteMember,
  useProfiles,
  useSessions,
} from "@/lib/queries";

export default function MembersPage() {
  const { t } = useI18n();
  const { data: profiles, isLoading } = useProfiles();
  const { data: payments } = useAllPayments();
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const deleteMember = useDeleteMember();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [deleting, setDeleting] = useState<MemberRow | null>(null);

  const members = useMemo<MemberRow[]>(() => {
    const list = (profiles ?? []).filter((p) => p.role === "member");
    return list.map((m) => {
      const myPayments = (payments ?? []).filter((p) => p.member_id === m.id);
      const totalPaid = myPayments.reduce((s, p) => s + Number(p.amount), 0);
      const used = usedSessionsSincePayment(
        (attendance ?? []).filter((a) => a.member_id === m.id),
        sessions ?? [],
        myPayments
      );
      const paid = myPayments.length > 0;
      const active = paid && used < m.subscription_sessions;
      const perSessionValue = paid ? memberPerSessionValue(m.id, payments ?? []) : 0;
      return { ...m, totalPaid, paid, active, perSessionValue };
    });
  }, [profiles, payments, attendance, sessions]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMember.mutateAsync(deleting.id);
      toast.success(t("members_delete_success"));
    } catch {
      toast.error(t("common_error"));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("members_title")} subtitle={t("members_subtitle")}>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <UserPlus className="h-4 w-4" />
          {t("members_add")}
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <MemberTable
          members={members}
          onEdit={(m) => { setEditing(m); setFormOpen(true); }}
          onDelete={setDeleting}
        />
      )}

      <MemberFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        member={editing ? { ...editing } : null}
        onCreated={() => setEditing(null)}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("members_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("members_delete_confirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t("common_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
