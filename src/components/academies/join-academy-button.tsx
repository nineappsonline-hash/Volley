"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { joinPublicAcademy } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";

/**
 * Joining is the same action from the directory and from the academy profile,
 * so both share this button. A visitor who is not signed up yet is sent to
 * signup with the academy attached to the URL, which lets the signup form show
 * which academy they picked and return them here afterwards instead of losing
 * their choice on a generic dashboard.
 */
export function JoinAcademyButton({
  academyId,
  className,
}: {
  academyId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [myAcademyId, setMyAcademyId] = useState<string | null>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      setUserId(user?.id ?? null);
      if (!user) {
        setMyAcademyId(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("academy_id")
        .eq("id", user.id)
        .maybeSingle();
      if (alive) setMyAcademyId(data?.academy_id ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const joined = myAcademyId === academyId;

  return (
    <Button
      type="button"
      className={className}
      disabled={busy || joined}
      onClick={async () => {
        if (!userId) {
          router.push(`/signup?academy=${academyId}`);
          return;
        }
        setBusy(true);
        try {
          const { data, error } = await joinPublicAcademy(academyId);
          if (error) throw error;
          if (data) {
            toast.success(t("directory_joined"));
            router.push("/dashboard");
            router.refresh();
          } else {
            toast.info(t("directory_already"));
          }
        } catch (error) {
          toast.error(errorMessage(error, t("sa_action_failed")));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {joined
        ? t("directory_joined")
        : userId
          ? t("directory_join")
          : t("directory_join_signup")}
    </Button>
  );
}