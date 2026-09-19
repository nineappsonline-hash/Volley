import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { EnterpriseGate } from "@/components/shared/enterprise-gate";
import { CoachAiClient } from "@/components/coach-ai/coach-ai-client";

export const metadata: Metadata = { title: "AI Coach Assistant" };

export default async function CoachAiPage() {
  await requireSession();
  return (
    <EnterpriseGate
      titleKey="enterprise_gate_ai_title"
      descriptionKey="enterprise_gate_ai_description"
      featureKeys={[
        "enterprise_gate_feat_ai_plans",
        "enterprise_gate_feat_ai_dev",
        "enterprise_gate_feat_ai_reports",
      ]}
    >
      <CoachAiClient />
    </EnterpriseGate>
  );
}