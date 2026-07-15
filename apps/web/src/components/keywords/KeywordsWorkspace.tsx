"use client";

import { Suspense } from "react";
import { Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { countryParser } from "@/lib/search-params";
import { AddKeywordsDialog } from "./AddKeywordsDialog";
import { KeywordFieldEditor } from "./KeywordFieldEditor";
import { KeywordMarketFilter } from "./KeywordMarketFilter";
import { KeywordsTable } from "./KeywordsTable";
import { KeywordsTableSkeleton } from "./skeletons";
import { SuggestionsPanel } from "./SuggestionsPanel";

export function KeywordsWorkspace({
  id,
  homeCountry,
  store,
}: {
  id: string;
  homeCountry: string;
  store: Store;
}) {
  const [country] = useQueryState("country", countryParser);
  const market = country || homeCountry;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Tracked keywords</h2>
          <p className="text-sm text-muted-foreground">
            The phrases you want this app to rank for, tracked per market.
          </p>
        </div>
        <AddKeywordsDialog appId={id} country={market}>
          <Button>
            <Plus />
            Add keywords
          </Button>
        </AddKeywordsDialog>
      </div>
      <Suspense fallback={null}>
        <KeywordMarketFilter id={id} active={market} />
      </Suspense>
      <Suspense fallback={<KeywordsTableSkeleton />}>
        <KeywordsTable id={id} country={market} />
      </Suspense>
      <SuggestionsPanel id={id} country={market} />
      {store === "APP_STORE" ? (
        <KeywordFieldEditor
          id={id}
          homeCountry={homeCountry}
          activeMarket={market}
        />
      ) : null}
    </div>
  );
}
