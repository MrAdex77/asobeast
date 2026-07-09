"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddKeywordsDialog } from "./AddKeywordsDialog";
import { KeywordsTable } from "./KeywordsTable";
import { SuggestionsPanel } from "./SuggestionsPanel";

export function KeywordsWorkspace({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Tracked keywords</h2>
          <p className="text-sm text-muted-foreground">
            The phrases you want this app to rank for.
          </p>
        </div>
        <AddKeywordsDialog appId={id}>
          <Button>
            <Plus />
            Add keywords
          </Button>
        </AddKeywordsDialog>
      </div>
      <KeywordsTable id={id} />
      <SuggestionsPanel id={id} />
    </div>
  );
}
