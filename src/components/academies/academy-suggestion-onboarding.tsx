"use client";

import { useEffect, useState } from "react";
import { JoinAcademySuggestion } from "@/components/academies/join-academy-suggestion";
import { SUGGEST_ACADEMY_KEY } from "@/components/auth/signup-form";

/**
 * Signup can only show the academy suggestion itself when the new account
 * already has a session. When the member still has to confirm their email
 * address, signup parks the offer and the dashboard raises it on arrival
 * instead — so the suggestion is never simply lost.
 */
export function AcademySuggestionOnboarding({
  memberName,
  hasAcademy,
}: {
  memberName?: string | null;
  hasAcademy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  useEffect(() => {
    // Someone who already joined has nothing to be sold.
    if (hasAcademy) return;
    let pending: string | null = null;
    try {
      pending = localStorage.getItem(SUGGEST_ACADEMY_KEY);
    } catch {
      return;
    }
    if (!pending) return;
    setHighlight(pending === "1" ? null : pending);
    setOpen(true);
  }, [hasAcademy]);

  if (hasAcademy) return null;

  return (
    <JoinAcademySuggestion
      open={open}
      onOpenChange={setOpen}
      memberName={memberName}
      highlightAcademyId={highlight}
      onDone={() => {
        try {
          localStorage.removeItem(SUGGEST_ACADEMY_KEY);
        } catch {
          // Nothing to clean up if storage is unavailable.
        }
      }}
    />
  );
}