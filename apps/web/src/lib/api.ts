import type {
  ApiErrorEnvelope,
  AppAuditResult,
  AppDetail,
  AppGroupSummary,
  AppListItem,
  AppSummary,
  AuditHistory,
  AuditInputAnswers,
  CategoryRankSeries,
  ChangeTimeline,
  CompetitorAnalysis,
  CompetitorDiscovery,
  CompetitorItem,
  DailyBudget,
  HealthStatus,
  KeywordCountrySummary,
  KeywordComparison,
  KeywordFieldResult,
  KeywordSort,
  KeywordSuggestion,
  KeywordSuggestionStrategy,
  MarketAvailabilityResult,
  MetadataAuditResult,
  PortfolioSummary,
  RankDistributionHistory,
  RankingSeries,
  RatingsHistogram,
  RatingsHistory,
  ReviewList,
  RunDailyResult,
  ScoreEnqueueResult,
  SerpMovers,
  SerpSnapshot,
  SnapshotDiffResult,
  SpiderEnqueueResult,
  SpiderStatus,
  TrackedKeywordItem,
  VisibilityHistory,
  AlertDeliveryItem,
  AlertsConfig,
  EmailAlertItem,
  WebhookEvent,
  WebhookItem,
  WebhookTestResult,
} from "@asobeast/shared";

const INTERNAL_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

function apiBase(): string {
  return typeof window === "undefined" ? INTERNAL_BASE : "/api/backend";
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

export function getPortfolio(): Promise<PortfolioSummary> {
  return apiFetch<PortfolioSummary>("/portfolio");
}

export function getApp(id: string): Promise<AppDetail> {
  return apiFetch<AppDetail>(`/apps/${id}`);
}

export function importApp(url: string, country?: string): Promise<AppDetail> {
  return apiFetch<AppDetail>("/apps", {
    method: "POST",
    body: JSON.stringify({ url, country }),
  });
}

export function deleteApp(id: string): Promise<void> {
  return apiFetch<void>(`/apps/${id}`, { method: "DELETE" });
}

export function linkApp(id: string, appId: string): Promise<AppGroupSummary> {
  return apiFetch<AppGroupSummary>(`/apps/${id}/link`, {
    method: "POST",
    body: JSON.stringify({ appId }),
  });
}

export function unlinkApp(id: string): Promise<void> {
  return apiFetch<void>(`/apps/${id}/link`, { method: "DELETE" });
}

export function getKeywords(
  appId: string,
  sort?: KeywordSort,
  country?: string,
): Promise<TrackedKeywordItem[]> {
  const params = new URLSearchParams();
  if (sort) params.set("sort", sort);
  if (country) params.set("country", country);
  return apiFetch<TrackedKeywordItem[]>(
    withQuery(`/apps/${appId}/keywords`, params),
  );
}

export function getKeywordCountries(
  appId: string,
): Promise<KeywordCountrySummary[]> {
  return apiFetch<KeywordCountrySummary[]>(`/apps/${appId}/keyword-countries`);
}

export function addKeywords(
  appId: string,
  keywords: string[],
  country?: string,
): Promise<TrackedKeywordItem[]> {
  return apiFetch<TrackedKeywordItem[]>(`/apps/${appId}/keywords`, {
    method: "POST",
    body: JSON.stringify({ keywords, country }),
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
  country?: string,
): Promise<KeywordSuggestion[]> {
  const params = new URLSearchParams({ strategy });
  if (limit !== undefined) params.set("limit", String(limit));
  if (country) params.set("country", country);
  return apiFetch<KeywordSuggestion[]>(
    withQuery(`/apps/${appId}/keywords/suggestions`, params),
  );
}

export function startSpider(
  appId: string,
  term: string,
): Promise<SpiderEnqueueResult> {
  return apiFetch<SpiderEnqueueResult>(`/apps/${appId}/keywords/spider`, {
    method: "POST",
    body: JSON.stringify({ term }),
  });
}

export function getSpiderStatus(
  appId: string,
  term: string,
): Promise<SpiderStatus> {
  const params = new URLSearchParams({ term });
  return apiFetch<SpiderStatus>(
    withQuery(`/apps/${appId}/keywords/spider`, params),
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

export function getRankDistributionHistory(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<RankDistributionHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<RankDistributionHistory>(
    withQuery(`/apps/${appId}/rank-distribution-history`, params),
  );
}

export interface ReviewFilters {
  score?: number;
  version?: string;
  limit?: number;
}

export function getReviews(
  appId: string,
  { score, version, limit }: ReviewFilters = {},
): Promise<ReviewList> {
  const params = new URLSearchParams();
  if (score !== undefined) params.set("score", String(score));
  if (version) params.set("version", version);
  if (limit !== undefined) params.set("limit", String(limit));
  return apiFetch<ReviewList>(withQuery(`/apps/${appId}/reviews`, params));
}

export function getRatingsHistogram(appId: string): Promise<RatingsHistogram> {
  return apiFetch<RatingsHistogram>(`/apps/${appId}/reviews/histogram`);
}

export function getMarketAvailability(
  appId: string,
  country: string,
): Promise<MarketAvailabilityResult> {
  const params = new URLSearchParams({ country });
  return apiFetch<MarketAvailabilityResult>(
    withQuery(`/apps/${appId}/market-availability`, params),
  );
}

export function getRatingsHistory(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<RatingsHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<RatingsHistory>(
    withQuery(`/apps/${appId}/ratings-history`, params),
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

export function getSerpMovers(
  appId: string,
  days?: number,
): Promise<SerpMovers> {
  const query = days !== undefined ? `?days=${days}` : "";
  return apiFetch<SerpMovers>(`/apps/${appId}/serp-movers${query}`);
}

export function getCategoryRanks(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<CategoryRankSeries> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<CategoryRankSeries>(
    withQuery(`/apps/${appId}/category-ranks`, params),
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

export function getChanges(
  appId: string,
  days?: number,
): Promise<ChangeTimeline> {
  const query = days !== undefined ? `?days=${days}` : "";
  return apiFetch<ChangeTimeline>(`/apps/${appId}/changes${query}`);
}

export function getRecentChanges(limit?: number): Promise<ChangeTimeline> {
  const query = limit !== undefined ? `?limit=${limit}` : "";
  return apiFetch<ChangeTimeline>(`/changes/recent${query}`);
}

export function getAudit(appId: string): Promise<AppAuditResult> {
  return apiFetch<AppAuditResult>(`/apps/${appId}/audit`);
}

export function getAuditHistory(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<AuditHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<AuditHistory>(
    withQuery(`/apps/${appId}/audit/history`, params),
  );
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

export function getWebhooks(): Promise<WebhookItem[]> {
  return apiFetch<WebhookItem[]>("/webhooks");
}

export function createWebhook(body: {
  url: string;
  events: WebhookEvent[];
  secret?: string;
}): Promise<WebhookItem> {
  return apiFetch<WebhookItem>("/webhooks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateWebhook(
  id: string,
  body: {
    url?: string;
    events?: WebhookEvent[];
    secret?: string;
    active?: boolean;
  },
): Promise<WebhookItem> {
  return apiFetch<WebhookItem>(`/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteWebhook(id: string): Promise<void> {
  return apiFetch<void>(`/webhooks/${id}`, { method: "DELETE" });
}

export function testWebhook(id: string): Promise<WebhookTestResult> {
  return apiFetch<WebhookTestResult>(`/webhooks/${id}/test`, {
    method: "POST",
  });
}

export function getAlertsConfig(): Promise<AlertsConfig> {
  return apiFetch<AlertsConfig>("/alerts/config");
}

export function getEmailAlerts(): Promise<EmailAlertItem[]> {
  return apiFetch<EmailAlertItem[]>("/email-alerts");
}

export function createEmailAlert(body: {
  email: string;
  events: WebhookEvent[];
}): Promise<EmailAlertItem> {
  return apiFetch<EmailAlertItem>("/email-alerts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateEmailAlert(
  id: string,
  body: {
    email?: string;
    events?: WebhookEvent[];
    active?: boolean;
  },
): Promise<EmailAlertItem> {
  return apiFetch<EmailAlertItem>(`/email-alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteEmailAlert(id: string): Promise<void> {
  return apiFetch<void>(`/email-alerts/${id}`, { method: "DELETE" });
}

export function testEmailAlert(id: string): Promise<WebhookTestResult> {
  return apiFetch<WebhookTestResult>(`/email-alerts/${id}/test`, {
    method: "POST",
  });
}

export function getDeliveries(
  filter: { webhookId: string } | { emailAlertId: string },
): Promise<AlertDeliveryItem[]> {
  const params = new URLSearchParams(filter);
  return apiFetch<AlertDeliveryItem[]>(`/alerts/deliveries?${params}`);
}

export function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health");
}

export function getBudget(): Promise<DailyBudget> {
  return apiFetch<DailyBudget>("/jobs/budget");
}
