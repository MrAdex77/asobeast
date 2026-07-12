import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  DATASETS,
  HEALTH,
  IMPORTED_APP,
  IMPORTED_APP_DETAIL,
  INITIAL_APPS,
  errorEnvelope,
} from "./fixtures.ts";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";

const PORT = Number(process.env.MOCK_API_PORT ?? 4100);
const ERROR_ID = "err-app";
const apps = [...INITIAL_APPS];

type Handler = (params: string[], req: IncomingMessage, res: ServerResponse) => void;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function scoreForSort(keyword: TrackedKeywordItem, sort: KeywordSort): number | null {
  if (sort === "traffic") return keyword.volume;
  if (sort === "difficulty") return keyword.difficulty;
  if (sort === "opportunity") return keyword.opportunity;
  return null;
}

function sortKeywords(list: TrackedKeywordItem[], sort: string | null): TrackedKeywordItem[] {
  if (sort === "position") {
    return [...list].sort(
      (a, b) => (a.latestPosition ?? Infinity) - (b.latestPosition ?? Infinity),
    );
  }
  if (sort === "traffic" || sort === "difficulty" || sort === "opportunity") {
    return [...list].sort(
      (a, b) =>
        (scoreForSort(b, sort) ?? -Infinity) - (scoreForSort(a, sort) ?? -Infinity),
    );
  }
  return list;
}

function appRoute(pattern: RegExp, pick: (dataset: (typeof DATASETS)[string]) => unknown): Route {
  return {
    method: "GET",
    pattern,
    handler: (params, req, res) => {
      const [id] = params;
      const path = req.url ?? "/";
      if (id === ERROR_ID) return json(res, 500, errorEnvelope(500, path));
      const dataset = DATASETS[id];
      if (!dataset) return json(res, 404, errorEnvelope(404, path));
      json(res, 200, pick(dataset));
    },
  };
}

const routes: Route[] = [
  { method: "GET", pattern: /^\/health$/, handler: (_p, _q, res) => json(res, 200, HEALTH) },
  { method: "GET", pattern: /^\/apps$/, handler: (_p, _q, res) => json(res, 200, apps) },
  {
    method: "POST",
    pattern: /^\/apps$/,
    handler: (_p, _q, res) => {
      if (!apps.some((app) => app.id === IMPORTED_APP.id)) apps.push(IMPORTED_APP);
      json(res, 201, IMPORTED_APP_DETAIL);
    },
  },
  appRoute(/^\/apps\/([^/]+)$/, (dataset) => dataset.detail),
  appRoute(/^\/apps\/([^/]+)\/summary$/, (dataset) => dataset.summary),
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/keywords$/,
    handler: (params, req, res) => {
      const [id] = params;
      const path = req.url ?? "/";
      if (id === ERROR_ID) return json(res, 500, errorEnvelope(500, path));
      const dataset = DATASETS[id];
      if (!dataset) return json(res, 404, errorEnvelope(404, path));
      const sort = new URL(path, "http://localhost").searchParams.get("sort");
      json(res, 200, sortKeywords(dataset.keywords, sort));
    },
  },
  appRoute(/^\/apps\/([^/]+)\/rankings$/, (dataset) => dataset.rankings),
  appRoute(/^\/apps\/([^/]+)\/visibility-history$/, (dataset) => dataset.visibility),
  appRoute(
    /^\/apps\/([^/]+)\/rank-distribution-history$/,
    (dataset) => dataset.rankDistributionHistory,
  ),
  appRoute(/^\/apps\/([^/]+)\/category-ranks$/, (dataset) => dataset.categoryRanks),
  appRoute(/^\/apps\/([^/]+)\/competitors$/, (dataset) => dataset.competitors),
  {
    method: "POST",
    pattern: /^\/apps\/([^/]+)\/refresh$/,
    handler: (_p, _q, res) => json(res, 200, { snapshotId: "snap-1", changes: [] }),
  },
  {
    method: "POST",
    pattern: /^\/apps\/([^/]+)\/run-daily$/,
    handler: (_p, _q, res) =>
      json(res, 202, { enqueued: { apps: 1, keywords: 5, categories: 1 } }),
  },
];

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = pathname.match(route.pattern);
    if (match) return route.handler(match.slice(1), req, res);
  }
  json(res, 404, errorEnvelope(404, req.url ?? "/"));
});

server.listen(PORT, () => {
  process.stdout.write(`mock-api listening on ${PORT}\n`);
});
