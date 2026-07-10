"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Plus, RotateCw } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import type {
  KeywordSuggestion,
  KeywordSuggestionStrategy,
  TrackedKeywordItem,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addKeywords, ApiError } from "@/lib/api";
import {
  invalidateKeywordMutation,
  keywordsOptions,
  suggestionsOptions,
} from "@/lib/queries";
import { sortParser, suggestionStrategyParser } from "@/lib/search-params";
import { cn } from "@/lib/utils";

const STRATEGIES: { value: KeywordSuggestionStrategy; label: string }[] = [
  { value: "metadata", label: "Metadata" },
  { value: "search", label: "Search" },
  { value: "similar", label: "Similar apps" },
  { value: "competitors", label: "Competitors" },
];

function SuggestionMeta({ suggestion }: { suggestion: KeywordSuggestion }) {
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      {suggestion.usedByCount !== undefined ? (
        <span className="tabular-nums">
          {suggestion.usedByCount}{" "}
          {suggestion.strategy === "competitors" ? "competitor" : "app"}
          {suggestion.usedByCount === 1 ? "" : "s"}
        </span>
      ) : null}
      {suggestion.priority !== undefined ? (
        <span className="tabular-nums">priority {Math.round(suggestion.priority)}</span>
      ) : null}
      {suggestion.event ? (
        <Badge variant="secondary">{suggestion.event}</Badge>
      ) : null}
    </span>
  );
}

export function SuggestionsPanel({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [strategy, setStrategy] = useQueryState(
    "strategy",
    suggestionStrategyParser,
  );
  const [sort] = useQueryState("sort", sortParser);

  const tracked = useQuery(keywordsOptions(id, sort));
  const trackedTexts = new Set(
    (tracked.data ?? []).map((keyword) => keyword.text),
  );

  const suggestions = useQuery({
    ...suggestionsOptions(id, strategy),
    enabled: open,
  });

  const track = useMutation({
    mutationFn: (text: string) => addKeywords(id, [text]),
    onSuccess: (_data, text) => {
      invalidateKeywordMutation(queryClient, id);
      toast.success(`Tracking ${text}`);
    },
    onError: (error, text) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : `Could not track ${text}`,
      ),
  });

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-start justify-between gap-4 text-left"
        >
          <div className="flex flex-col gap-1">
            <CardTitle>Suggestions</CardTitle>
            <CardDescription>
              Search and Similar apps query the App Store live, so results can
              take a few seconds.
            </CardDescription>
          </div>
          <ChevronDown
            className={cn(
              "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CardHeader>

      {open ? (
        <CardContent className="flex flex-col gap-4">
          <Tabs
            value={strategy}
            onValueChange={(value) =>
              setStrategy(value as KeywordSuggestionStrategy)
            }
          >
            <TabsList>
              {STRATEGIES.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {suggestions.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : suggestions.isError ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <span>
                {suggestions.error instanceof ApiError
                  ? suggestions.error.envelope.message
                  : "Could not load suggestions."}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => suggestions.refetch()}
              >
                <RotateCw />
                Retry
              </Button>
            </div>
          ) : suggestions.data.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No new suggestions from this source right now.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {suggestions.data.map((suggestion) => {
                const already = trackedTexts.has(suggestion.text);
                const pending =
                  track.isPending && track.variables === suggestion.text;
                return (
                  <li
                    key={suggestion.text}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {suggestion.text}
                      </span>
                      <SuggestionMeta suggestion={suggestion} />
                    </div>
                    <Button
                      variant={already ? "ghost" : "outline"}
                      size="sm"
                      disabled={already || pending}
                      onClick={() => track.mutate(suggestion.text)}
                    >
                      {already ? (
                        <>
                          <Check />
                          Tracked
                        </>
                      ) : pending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <>
                          <Plus />
                          Track
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
