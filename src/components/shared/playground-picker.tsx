"use client";

import { useMemo, useState } from "react";
import { Check, LandPlot, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { Venue } from "@/lib/types";
import { PlaygroundOptionCard } from "./playground-option-card";
import { cn } from "@/lib/utils";

/**
 * Playground chooser for a game. The parent dialog already narrows the list to
 * the member's chosen location; here we narrow it to the chosen sport and let
 * the member search. Each playground renders as a card with a thumbnail,
 * distance, directions and a details dialog.
 */
export function PlaygroundPicker({
  value,
  onChange,
  playgrounds,
  sport,
}: {
  value: string;
  onChange: (v: string) => void;
  playgrounds: Venue[];
  sport: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const bySport = useMemo(() => {
    if (!sport) return [];
    const want = sport.trim().toLowerCase();
    return playgrounds.filter(
      (p) => p.sport?.name.trim().toLowerCase() === want,
    );
  }, [playgrounds, sport]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bySport;
    return bySport.filter((p) =>
      [p.name, p.governorate, p.area]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [bySport, query]);

  const selected = playgrounds.find((p) => p.id === value);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("games_playground_search")}
          className="ps-9"
        />
      </div>

      <div className="max-h-60 overflow-auto rounded-lg border">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-accent",
            value === "" && "bg-accent",
          )}
        >
          <span className="text-muted-foreground">
            {t("games_playground_any")}
          </span>
          {value === "" && <Check className="h-4 w-4 shrink-0 opacity-70" />}
        </button>
        {matches.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t("games_playground_empty")}
          </p>
        ) : (
          matches.map((p) => (
            <PlaygroundOptionCard
              key={p.id}
              playground={p}
              selected={value === p.id}
              onSelect={() => onChange(p.id)}
            />
          ))
        )}
      </div>

      {selected && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LandPlot className="h-3.5 w-3.5 shrink-0 text-primary" />
          {t("games_playground_selected")}
        </p>
      )}
    </div>
  );
}