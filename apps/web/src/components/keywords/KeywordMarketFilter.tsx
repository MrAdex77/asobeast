"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { formatCountry } from "@/lib/format";
import { keywordCountriesOptions } from "@/lib/queries";
import { countryParser } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { AddKeywordsDialog } from "./AddKeywordsDialog";

export function KeywordMarketFilter({
  id,
  active,
}: {
  id: string;
  active: string;
}) {
  const [, setCountry] = useQueryState("country", countryParser);
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));

  return (
    <div
      role="tablist"
      aria-label="Keyword markets"
      className="flex flex-wrap items-center gap-2"
    >
      {markets.map((market) => {
        const selected = market.country === active;
        return (
          <button
            key={market.country}
            type="button"
            role="tab"
            aria-selected={selected}
            title={formatCountry(market.country)}
            onClick={() => void setCountry(market.country)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
              selected
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-muted",
            )}
          >
            <span className="font-medium">{market.country.toUpperCase()}</span>
            <span className="text-xs tabular-nums opacity-70">
              {market.keywordCount}
            </span>
          </button>
        );
      })}
      <AddKeywordsDialog appId={id} country={active}>
        <Button variant="outline" size="sm" aria-label="Add a market">
          <Plus />
        </Button>
      </AddKeywordsDialog>
    </div>
  );
}
