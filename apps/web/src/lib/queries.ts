import type { KeywordSort, KeywordSuggestionStrategy } from "@asobeast/shared";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import {
  getApp,
  getApps,
  getChanges,
  getComparison,
  getCompetitorDiscovery,
  getCompetitors,
  getHealth,
  getKeywords,
  getRankings,
  getSerp,
  getSuggestions,
  getSummary,
  getVisibilityHistory,
  getWebhooks,
  type RangeParams,
  type RankingParams,
} from "./api";

export const appKeys = {
  all: ["apps"] as const,
  detail: (id: string) => [...appKeys.all, id] as const,
  summary: (id: string) => [...appKeys.detail(id), "summary"] as const,
  keywordsRoot: (id: string) => [...appKeys.detail(id), "keywords"] as const,
  compareRoot: (id: string) => [...appKeys.detail(id), "compare"] as const,
  keywords: (id: string, sort?: KeywordSort) =>
    [...appKeys.detail(id), "keywords", { sort }] as const,
  suggestions: (id: string, strategy: KeywordSuggestionStrategy) =>
    [...appKeys.detail(id), "suggestions", strategy] as const,
  compare: (id: string, onlyGaps: boolean) =>
    [...appKeys.detail(id), "compare", { onlyGaps }] as const,
  rankings: (id: string, params: RankingParams) =>
    [...appKeys.detail(id), "rankings", params] as const,
  visibility: (id: string, params: RangeParams) =>
    [...appKeys.detail(id), "visibility", params] as const,
  competitors: (id: string) => [...appKeys.detail(id), "competitors"] as const,
  discoveryRoot: (id: string) => [...appKeys.detail(id), "discovery"] as const,
  discovery: (id: string, days: number) =>
    [...appKeys.detail(id), "discovery", { days }] as const,
  changesRoot: (id: string) => [...appKeys.detail(id), "changes"] as const,
  changes: (id: string, days: number) =>
    [...appKeys.detail(id), "changes", { days }] as const,
  serp: (keywordId: string) => ["serp", keywordId] as const,
};

export const webhookKeys = {
  all: ["webhooks"] as const,
};

export const healthKey = ["health"] as const;

export const appsListOptions = queryOptions({
  queryKey: appKeys.all,
  queryFn: getApps,
});

export const appDetailOptions = (id: string) =>
  queryOptions({
    queryKey: appKeys.detail(id),
    queryFn: () => getApp(id),
  });

export const appSummaryOptions = (id: string) =>
  queryOptions({
    queryKey: appKeys.summary(id),
    queryFn: () => getSummary(id),
  });

export const keywordsOptions = (id: string, sort?: KeywordSort) =>
  queryOptions({
    queryKey: appKeys.keywords(id, sort),
    queryFn: () => getKeywords(id, sort),
  });

export const suggestionsOptions = (
  id: string,
  strategy: KeywordSuggestionStrategy,
) =>
  queryOptions({
    queryKey: appKeys.suggestions(id, strategy),
    queryFn: () => getSuggestions(id, strategy),
  });

export const comparisonOptions = (id: string, onlyGaps: boolean) =>
  queryOptions({
    queryKey: appKeys.compare(id, onlyGaps),
    queryFn: () => getComparison(id, onlyGaps),
  });

export const rankingsOptions = (id: string, params: RankingParams) =>
  queryOptions({
    queryKey: appKeys.rankings(id, params),
    queryFn: () => getRankings(id, params),
  });

export const visibilityOptions = (id: string, params: RangeParams) =>
  queryOptions({
    queryKey: appKeys.visibility(id, params),
    queryFn: () => getVisibilityHistory(id, params),
  });

export const competitorsOptions = (id: string) =>
  queryOptions({
    queryKey: appKeys.competitors(id),
    queryFn: () => getCompetitors(id),
  });

export const discoveryOptions = (id: string, days: number) =>
  queryOptions({
    queryKey: appKeys.discovery(id, days),
    queryFn: () => getCompetitorDiscovery(id, days),
  });

export const changesOptions = (id: string, days: number) =>
  queryOptions({
    queryKey: appKeys.changes(id, days),
    queryFn: () => getChanges(id, days),
  });

export const serpOptions = (keywordId: string) =>
  queryOptions({
    queryKey: appKeys.serp(keywordId),
    queryFn: () => getSerp(keywordId),
  });

export const webhooksOptions = queryOptions({
  queryKey: webhookKeys.all,
  queryFn: getWebhooks,
});

export const healthOptions = queryOptions({
  queryKey: healthKey,
  queryFn: getHealth,
  refetchInterval: 30_000,
});

export function invalidateKeywords(client: QueryClient, id: string): void {
  void client.invalidateQueries({ queryKey: appKeys.keywordsRoot(id) });
}

export function invalidateKeywordMutation(
  client: QueryClient,
  id: string,
): void {
  void client.invalidateQueries({ queryKey: appKeys.keywordsRoot(id) });
  void client.invalidateQueries({ queryKey: appKeys.summary(id) });
  void client.invalidateQueries({ queryKey: appKeys.compareRoot(id) });
}

export function invalidateCompetitorMutation(
  client: QueryClient,
  id: string,
): void {
  void client.invalidateQueries({ queryKey: appKeys.detail(id) });
  void client.invalidateQueries({ queryKey: appKeys.discoveryRoot(id) });
}

export function invalidateWebhookMutation(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: webhookKeys.all });
}
