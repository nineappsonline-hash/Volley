"use client";

import dynamic from "next/dynamic";
import { Map as MapIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { MembersTab } from "./members-tab";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const DiscoverMap = dynamic(() => import("./discover-map"), {
  ssr: false,
  loading: () => <div />,
});

export function CommunityClient({ profile }: { profile: Profile }) {
  const { t, lang } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader title={t("community_title")} subtitle={lang === "ar" ? "اتعرف على لاعبين واكتشف المجتمع حواليك." : "Meet players and discover your local community."}>
        <Button asChild variant="outline"><Link href="/dashboard/games">{t("nav_games")}</Link></Button>
      </PageHeader>

      <Tabs defaultValue="members">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="members">{t("community_tab_members")}</TabsTrigger>
          <TabsTrigger value="map" className="gap-1.5">
            <MapIcon className="h-3.5 w-3.5" />
            {t("community_tab_map")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4">
          <MembersTab profile={profile} />
        </TabsContent>
        <TabsContent value="map" className="mt-4">
          <DiscoverMap profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}