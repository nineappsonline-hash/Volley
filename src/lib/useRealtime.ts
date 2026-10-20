"use client";

import { useEffect, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

type TableName =
  | "attendance"
  | "payments"
  | "training_sessions"
  | "profiles"
  | "monthly_costs"
  | "session_calculations"
  | "session_guests"
  | "friendly_game_participants"
  | "friendly_games"
  | "notifications"
  | "contact_messages"
  | "player_evaluations";

const queryKeyForTable: Record<TableName, string[]> = {
  attendance: ["attendance"],
  payments: ["payments"],
  training_sessions: ["sessions"],
  profiles: ["profiles"],
  monthly_costs: ["costs"],
  session_calculations: ["calculations"],
  session_guests: ["guests"],
  friendly_games: ["friendly-games", "my-game-participants"],
  friendly_game_participants: ["my-game-participants", "friendly-games"],
  notifications: ["notifications"],
  contact_messages: ["contact-messages"],
  player_evaluations: ["evaluations"],
};

/**
 * Subscribes to realtime changes on the given tables and invalidates
 * the related React Query caches so the UI stays in sync.
 *
 * Each instance uses a unique channel name because connected channels are
 * deduplicated by topic — reusing the same topic from two components would
 * call `.on()` on an already-subscribed channel and throw.
 */
export function useRealtime(tables: TableName[], enabled = true) {
  const queryClient = useQueryClient();
  const uid = useId().replace(/[:]/g, "");

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const client = createClient();

    const channels = tables.map((table) =>
      client
        .channel(`realtime-${table}-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            queryKeyForTable[table].forEach((key) => {
              queryClient.invalidateQueries({ queryKey: [key] });
            });
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((c) => client.removeChannel(c));
    };
  }, [queryClient, uid, enabled, tables.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
}
