import type {
  ApiErrorEnvelope,
  AppAuditResult,
  AppDetail,
  AppListItem,
  AppSummary,
  AuditInputAnswers,
  CompetitorAnalysis,
  CompetitorDiscovery,
  CompetitorItem,
  HealthStatus,
  KeywordComparison,
  KeywordFieldResult,
  KeywordSort,
  KeywordSuggestion,
  KeywordSuggestionStrategy,
  MetadataAuditResult,
  RankingSeries,
  RunDailyResult,
  ScoreEnqueueResult,
  SerpSnapshot,
  SnapshotDiffResult,
  TrackedKeywordItem,
  VisibilityHistory,
} from "@asobeast/shared";

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const INTERNAL_BASE = process.env.API_INTERNAL_URL ?? PUBLIC_BASE;

function apiBase(): string {
  return typeof window === "undefined" ? INTERNAL_BASE : PUBLIC_BASE;
}

export class ApiError extends Error {
  constructor(public readonly envelope: ApiErrorEnvelope) {
    super(envelope.message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError((await res.json()) as ApiErrorEnvelope);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface RangeParams {
  from?: string;
  to?: string;
}

export interface RankingParams extends RangeParams {
  keywordIds?: string[];
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function getApps(): Promise<AppListItem[]> {
  return apiFetch<AppListItem[]>("/apps");
}

export function getApp(id: string): Promise<AppDetail> {
  return apiFetch<AppDetail>(`/apps/${id}`);
}

export function importApp(url: string): Promise<AppDetail> {
  return apiFetch<AppDetail>("/apps", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function deleteApp(id: string): Promise<void> {
  return apiFetch<void>(`/apps/${id}`, { method: "DELETE" });
}

export function getKeywords(
  appId: string,
  sort?: KeywordSort,
): Promise<TrackedKeywordItem[]> {
  const query = sort ? `?sort=${sort}` : "";
  return apiFetch<TrackedKeywordItem[]>(`/apps/${appId}/keywords${query}`);
}

export function addKeywords(
  appId: string,
  keywords: string[],
): Promise<TrackedKeywordItem[]> {
  return apiFetch<TrackedKeywordItem[]>(`/apps/${appId}/keywords`, {
    method: "POST",
    body: JSON.stringify({ keywords }),
  });
}

export function updateKeyword(
  appId: string,
  keywordId: string,
  body: { active?: boolean; relevance?: number | null },
): Promise<TrackedKeywordItem> {
  return apiFetch<TrackedKeywordItem>(`/apps/${appId}/keywords/${keywordId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function removeKeyword(
  appId: string,
  keywordId: string,
): Promise<void> {
  return apiFetch<void>(`/apps/${appId}/keywords/${keywordId}`, {
    method: "DELETE",
  });
}

export function getSuggestions(
  appId: string,
  strategy: KeywordSuggestionStrategy,
  limit?: number,
): Promise<KeywordSuggestion[]> {
  const params = new URLSearchParams({ strategy });
  if (limit !== undefined) params.set("limit", String(limit));
  return apiFetch<KeywordSuggestion[]>(
    withQuery(`/apps/${appId}/keywords/suggestions`, params),
  );
}

export function getComparison(
  appId: string,
  onlyGaps?: boolean,
): Promise<KeywordComparison> {
  const params = new URLSearchParams();
  if (onlyGaps) params.set("onlyGaps", "true");
  return apiFetch<KeywordComparison>(
    withQuery(`/apps/${appId}/keywords/compare`, params),
  );
}

export function setKeywordField(
  appId: string,
  text: string,
): Promise<KeywordFieldResult> {
  return apiFetch<KeywordFieldResult>(`/apps/${appId}/keyword-field`, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}

export function getSummary(appId: string): Promise<AppSummary> {
  return apiFetch<AppSummary>(`/apps/${appId}/summary`);
}

export function getVisibilityHistory(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<VisibilityHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<VisibilityHistory>(
    withQuery(`/apps/${appId}/visibility-history`, params),
  );
}

export function getRankings(
  appId: string,
  { from, to, keywordIds }: RankingParams = {},
): Promise<RankingSeries> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (keywordIds && keywordIds.length > 0) {
    params.set("keywordIds", keywordIds.join(","));
  }
  return apiFetch<RankingSeries>(
    withQuery(`/apps/${appId}/rankings`, params),
  );
}

export function getSerp(
  keywordId: string,
  date?: string,
): Promise<SerpSnapshot> {
  const query = date ? `?date=${date}` : "";
  return apiFetch<SerpSnapshot>(`/keywords/${keywordId}/serp${query}`);
}

export function refreshApp(id: string): Promise<SnapshotDiffResult> {
  return apiFetch<SnapshotDiffResult>(`/apps/${id}/refresh`, { method: "POST" });
}

export function runDaily(id: string): Promise<RunDailyResult> {
  return apiFetch<RunDailyResult>(`/apps/${id}/run-daily`, { method: "POST" });
}

export function scoreKeyword(keywordId: string): Promise<ScoreEnqueueResult> {
  return apiFetch<ScoreEnqueueResult>(`/keywords/${keywordId}/score`, {
    method: "POST",
  });
}

export function getCompetitors(appId: string): Promise<CompetitorItem[]> {
  return apiFetch<CompetitorItem[]>(`/apps/${appId}/competitors`);
}

export function addCompetitor(
  appId: string,
  url: string,
): Promise<CompetitorItem> {
  return apiFetch<CompetitorItem>(`/apps/${appId}/competitors`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function removeCompetitor(
  appId: string,
  competitorId: string,
): Promise<void> {
  return apiFetch<void>(`/apps/${appId}/competitors/${competitorId}`, {
    method: "DELETE",
  });
}

export function getCompetitorAnalysis(
  appId: string,
): Promise<CompetitorAnalysis> {
  return apiFetch<CompetitorAnalysis>(`/apps/${appId}/competitors/analysis`);
}

export function getCompetitorDiscovery(
  appId: string,
  days?: number,
): Promise<CompetitorDiscovery> {
  const query = days !== undefined ? `?days=${days}` : "";
  return apiFetch<CompetitorDiscovery>(
    `/apps/${appId}/competitors/discovery${query}`,
  );
}

export function getAudit(appId: string): Promise<AppAuditResult> {
  return apiFetch<AppAuditResult>(`/apps/${appId}/audit`);
}

export function saveAuditInputs(
  appId: string,
  answers: AuditInputAnswers,
): Promise<AppAuditResult> {
  return apiFetch<AppAuditResult>(`/apps/${appId}/audit/inputs`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });
}

export function getMetadataAudit(appId: string): Promise<MetadataAuditResult> {
  return apiFetch<MetadataAuditResult>(`/apps/${appId}/metadata/audit`);
}

export function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health");
}
