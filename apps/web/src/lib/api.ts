import type {
  ApiErrorEnvelope,
  AppAuditResult,
  AppDetail,
  AppListItem,
  AppSummary,
  AuditInputAnswers,
  CompetitorAnalysis,
  KeywordSort,
  MetadataAuditResult,
  SnapshotDiffResult,
  TrackedKeywordItem,
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
  return res.json() as Promise<T>;
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

export function getKeywords(
  appId: string,
  sort?: KeywordSort,
): Promise<TrackedKeywordItem[]> {
  const query = sort ? `?sort=${sort}` : "";
  return apiFetch<TrackedKeywordItem[]>(`/apps/${appId}/keywords${query}`);
}

export function getSummary(appId: string): Promise<AppSummary> {
  return apiFetch<AppSummary>(`/apps/${appId}/summary`);
}

export function refreshApp(id: string): Promise<SnapshotDiffResult> {
  return apiFetch<SnapshotDiffResult>(`/apps/${id}/refresh`, { method: "POST" });
}

export async function runDaily(id: string): Promise<void> {
  await apiFetch<unknown>(`/apps/${id}/run-daily`, { method: "POST" });
}

export function getAudit(appId: string): Promise<AppAuditResult> {
  return apiFetch<AppAuditResult>(`/apps/${appId}/audit`);
}

export function getMetadataAudit(appId: string): Promise<MetadataAuditResult> {
  return apiFetch<MetadataAuditResult>(`/apps/${appId}/metadata/audit`);
}

export function getCompetitorAnalysis(
  appId: string,
): Promise<CompetitorAnalysis> {
  return apiFetch<CompetitorAnalysis>(`/apps/${appId}/competitors/analysis`);
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

export function saveAuditInputs(
  appId: string,
  answers: AuditInputAnswers,
): Promise<AppAuditResult> {
  return apiFetch<AppAuditResult>(`/apps/${appId}/audit/inputs`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });
}
