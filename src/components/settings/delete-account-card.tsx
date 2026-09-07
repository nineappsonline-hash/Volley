"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";

export function DeleteAccountCard({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const { signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setEmail(data.user?.email ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmed = confirmText.trim().toLowerCase() === email.trim().toLowerCase();

  const handleDelete = async () => {
    if (!confirmed || deleting) return;
    setDeleting(true);
    try {
      const { error } = await createClient().rpc("delete_my_account");
      if (error) throw error;
      toast.success(t("delete_account_success"));
      await signOut();
      router.push("/");
      router.refresh();
    } catch (err: any) {
      toast.error(errorMessage(err, t("common_error")));
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <Trash2 className="h-4 w-4" />
          {t("delete_account_title")}
        </CardTitle>
        <CardDescription className="text-xs">
          {isAdmin ? t("delete_account_desc_academy") : t("delete_account_desc_member")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <AlertTriangle className="h-4 w-4" />
              {t("delete_account_button")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {t("delete_account_confirm_title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isAdmin
                  ? t("delete_account_confirm_academy")
                  : t("delete_account_confirm_member")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground" dir="ltr">
                {t("delete_account_type_email").replaceAll(
                  "{email}",
                  email ?? ""
                )}
              </p>
              <Input
                dir="ltr"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={email ?? ""}
                autoComplete="off"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>
                {t("common_cancel")}
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  disabled={!confirmed || deleting}
                  onClick={handleDelete}
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("delete_account_confirm_action")}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}