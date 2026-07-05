import type {
  ApiErrorEnvelope,
  AppDetail,
  AppListItem,
  AppSummary,
  KeywordSort,
  SnapshotDiffResult,
  TrackedKeywordItem,
} from "@asobeast/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public readonly envelope: ApiErrorEnvelope) {
    super(envelope.message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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
