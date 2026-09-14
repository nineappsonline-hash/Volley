"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { useI18n } from "@/lib/i18n";

/**
 * "Create a tournament" entry point on the public /tournaments page.
 * Rendered only for logged-in academy admins and the platform admin;
 * joins the dashboard tournaments page with the create dialog open.
 */
export function OrganizeTournamentButton() {
  const { t } = useI18n();
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    let alive = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!alive) return;
        const user = data.user;
        setCanCreate(
          !!user &&
            (isPlatformAdmin(user) ||
              user.app_metadata?.role === "admin")
        );
      })
      .catch(() => {
        if (alive) setCanCreate(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!canCreate) return null;

  return (
    <Button asChild size="lg" className="gap-2">
      <Link href="/dashboard/tournaments?create=1">
        <Trophy className="h-5 w-5" />
        {t("tournament_create_public_button")}
      </Link>
    </Button>
  );
}