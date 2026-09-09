"use client";

import { useEffect } from "react";
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
  | "friendly_games"
  | "notifications"
  | "player_evaluations";

const queryKeyForTable: Record<TableName, string[]> = {
  attendance: ["attendance"],
  payments: ["payments"],
  training_sessions: ["sessions"],
  profiles: ["profiles"],
  monthly_costs: ["costs"],
  session_calculations: ["calculations"],
  session_guests: ["guests"],
  friendly_games: ["friendly-games"],
  notifications: ["notifications"],
  player_evaluations: ["evaluations"],
};

/**
 * Subscribes to realtime changes on the given tables and invalidates
 * the related React Query caches so the UI stays in sync.
 */
export function useRealtime(tables: TableName[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const client = createClient();

    const channels = tables.map((table) =>
      client
        .channel(`realtime-${table}`)
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
  }, [queryClient, tables.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
}
