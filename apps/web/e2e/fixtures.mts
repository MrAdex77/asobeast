import type {
  AlertDeliveryItem,
  ApiErrorEnvelope,
  AppDetail,
  AppListItem,
  AppSummary,
  CategoryRankSeries,
  DailyBudget,
  EmailAlertItem,
  KeywordCountrySummary,
  ChangeTimeline,
  CompetitorItem,
  HealthStatus,
  PortfolioSummary,
  RankDistributionHistory,
  RankingPoint,
  RankingSeries,
  RatingsHistory,
  ReviewList,
  SerpMovers,
  TrackedKeywordItem,
  VisibilityHistory,
} from "@asobeast/shared";

function utcDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function utcTimestampDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function pointsFrom(positions: Array<number | null>): RankingPoint[] {
  return positions.map((position, index) => ({
    date: utcDaysAgo(positions.length - 1 - index),
    position,
  }));
}

export const HEALTH: HealthStatus = { status: "ok", db: "up" };

export const APP_1_KEYWORDS: TrackedKeywordItem[] = [
  {
    keywordId: "kw-1",
    text: "focus timer",
    country: "us",
    serpVolatility7d: 8,
    source: "TITLE",
    active: true,
    latestPosition: 3,
    previousPosition: 5,
    positionDelta1d: -2,
    positionDelta7d: -7,
    traffic: 55,
    difficulty: 4,
    volume: 5000,
    relevance: 90,
    opportunity: 82,
    bucket: "primary",
    scoredAt: utcTimestampDaysAgo(0),
  },
  {
    keywordId: "kw-2",
    text: "pomodoro",
    country: "us",
    serpVolatility7d: 72,
    source: "SUBTITLE",
    active: true,
    latestPosition: 12,
    previousPosition: 9,
    positionDelta1d: 3,
    positionDelta7d: 6,
    traffic: 70,
    difficulty: 7,
    volume: 9000,
    relevance: 60,
    opportunity: 60,
    bucket: "secondary",
    scoredAt: utcTimestampDaysAgo(0),
  },
  {
    keywordId: "kw-3",
    text: "study timer",
    country: "us",
    serpVolatility7d: 35,
    source: "DESCRIPTION",
    active: true,
    latestPosition: 7,
    previousPosition: 7,
    positionDelta1d: 0,
    positionDelta7d: 0,
    traffic: 40,
    difficulty: 5,
    volume: 3000,
    relevance: 55,
    opportunity: 45,
    bucket: "longtail",
    scoredAt: utcTimestampDaysAgo(0),
  },
  {
    keywordId: "kw-4",
    text: "productivity app",
    country: "us",
    serpVolatility7d: null,
    source: "MANUAL",
    active: true,
    latestPosition: null,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: 65,
    difficulty: 6,
    volume: 8000,
    relevance: 80,
    opportunity: 70,
    bucket: "aspirational",
    scoredAt: utcTimestampDaysAgo(0),
  },
  {
    keywordId: "kw-5",
    text: "time blocking",
    country: "us",
    serpVolatility7d: 50,
    source: "COMPETITOR",
    active: false,
    latestPosition: 45,
    previousPosition: 44,
    positionDelta1d: 1,
    positionDelta7d: 5,
    traffic: 20,
    difficulty: 3,
    volume: 1000,
    relevance: 30,
    opportunity: 30,
    bucket: "longtail",
    scoredAt: utcTimestampDaysAgo(0),
  },
];

export const APP_1_RANKINGS: RankingSeries = {
  series: [
    { keywordId: "kw-1", text: "focus timer", points: pointsFrom([10, 9, 8, 7, 6, 5, 5, 3]) },
    { keywordId: "kw-2", text: "pomodoro", points: pointsFrom([6, 7, 8, 8, 9, 9, 9, 12]) },
    { keywordId: "kw-3", text: "study timer", points: pointsFrom([7, 7, 7, 7, 7, 7, 7, 7]) },
    {
      keywordId: "kw-4",
      text: "productivity app",
      points: pointsFrom([null, null, null, null, null, null, null, null]),
    },
    { keywordId: "kw-5", text: "time blocking", points: pointsFrom([40, 42, 44, 45, 45, 46, 46, 45]) },
  ],
};

export const APP_1_SERP_MOVERS: SerpMovers = {
  windowDays: 7,
  items: [
    {
      date: utcDaysAgo(1),
      keywordId: "kw-1",
      text: "focus timer",
      position: 4,
      storeAppId: "comp-store",
      title: "Rival Focus",
      appId: "comp-1",
      isCompetitor: true,
    },
    {
      date: utcDaysAgo(1),
      keywordId: "kw-2",
      text: "pomodoro",
      position: 7,
      storeAppId: "stranger-store",
      title: "Newcomer Timer",
      appId: null,
      isCompetitor: false,
    },
    {
      date: utcDaysAgo(3),
      keywordId: "kw-3",
      text: "study timer",
      position: 9,
      storeAppId: "late-store",
      title: "Late Bloomer",
      appId: null,
      isCompetitor: false,
    },
  ],
};

export const APP_1_SUMMARY: AppSummary = {
  visibility: { current: 62.4, delta7d: 5, delta30d: -3 },
  rankDistribution: { top1: 1, top3: 2, top10: 3, top50: 4, beyond: 0, unranked: 1 },
  movers: {
    up: [{ keywordId: "kw-1", text: "focus timer", from: 10, to: 3 }],
    down: [{ keywordId: "kw-2", text: "pomodoro", from: 6, to: 12 }],
  },
  coverage: {
    inTitle: 2,
    inSubtitle: 1,
    inDescription: 3,
    uncoveredHighOpportunity: [
      { keywordId: "kw-4", text: "productivity app", opportunity: 70 },
    ],
  },
  lastRefreshAt: utcTimestampDaysAgo(0),
  trackedKeywords: 5,
  competitors: 1,
};

export const APP_1_VISIBILITY: VisibilityHistory = {
  points: Array.from({ length: 30 }, (_, index) => ({
    date: utcDaysAgo(29 - index),
    visibility: 50 + (index % 12),
  })),
};

export const APP_1_RANK_DISTRIBUTION_HISTORY: RankDistributionHistory = {
  points: Array.from({ length: 30 }, (_, index) => ({
    date: utcDaysAgo(29 - index),
    rank1: 1,
    rank2to3: 1,
    rank4to10: 1,
    rank11to50: 1,
    rank51plus: 0,
    unranked: 1 + (index % 2),
  })),
};

export const APP_1_CATEGORY_RANKS: CategoryRankSeries = {
  series: [
    {
      collection: "free",
      genreId: 0,
      genreName: "Productivity",
      current: 42,
      points: Array.from({ length: 30 }, (_, index) => ({
        date: utcDaysAgo(29 - index),
        position: 60 - index,
      })),
    },
  ],
};

export const APP_1_REVIEWS: ReviewList = {
  total: 3,
  versions: ["3.4.1", "3.4.0"],
  reviews: [
    {
      id: "rev-1",
      reviewId: "store-rev-1",
      userName: "Casey",
      score: 5,
      title: "Love the focus timer",
      text: "Best pomodoro app I have used.",
      version: "3.4.1",
      reviewedAt: utcTimestampDaysAgo(1),
    },
    {
      id: "rev-2",
      reviewId: "store-rev-2",
      userName: "Jordan",
      score: 2,
      title: "Crashes often",
      text: "It crashes when I start a session.",
      version: "3.4.0",
      reviewedAt: utcTimestampDaysAgo(3),
    },
    {
      id: "rev-3",
      reviewId: "store-rev-3",
      userName: null,
      score: 1,
      title: null,
      text: "Please add dark mode.",
      version: "3.4.0",
      reviewedAt: utcTimestampDaysAgo(5),
    },
  ],
};

export const APP_1_RATINGS_HISTORY: RatingsHistory = {
  points: Array.from({ length: 30 }, (_, index) => ({
    date: utcDaysAgo(29 - index),
    ratingAvg: 4.6 + (index % 4) * 0.05,
    ratingCount: 20000 + index * 130,
  })),
};

export const APP_1_COMPETITORS: CompetitorItem[] = [
  {
    id: "comp-1",
    store: "APP_STORE",
    name: "Rival Focus",
    iconUrl: null,
    latestSnapshot: {
      id: "snap-comp-1",
      title: "Rival Focus",
      subtitle: "Deep work timer",
      summary: null,
      ratingAvg: 4.5,
      ratingCount: 12000,
      installs: null,
      price: 0,
      version: "2.1.0",
      capturedAt: utcTimestampDaysAgo(0),
    },
  },
];

export const APP_1_DETAIL: AppDetail = {
  id: "app-1",
  store: "APP_STORE",
  storeAppId: "123456789",
  country: "us",
  name: "Focus Timer",
  iconUrl: null,
  createdAt: utcTimestampDaysAgo(30),
  latestSnapshot: {
    id: "snap-1",
    title: "Focus Timer",
    subtitle: "Pomodoro & deep work",
    summary: "Stay focused with timed work sessions.",
    ratingAvg: 4.8,
    ratingCount: 24000,
    installs: null,
    price: 0,
    version: "3.4.1",
    capturedAt: utcTimestampDaysAgo(0),
  },
  competitors: APP_1_COMPETITORS,
};

export const APP_1: AppListItem = {
  id: "app-1",
  store: "APP_STORE",
  country: "us",
  name: "Focus Timer",
  iconUrl: null,
  ratingAvg: 4.8,
  ratingCount: 24000,
  capturedAt: utcTimestampDaysAgo(0),
  trackedKeywordCount: 5,
  competitorCount: 1,
};

export const APP_2_SUMMARY: AppSummary = {
  visibility: { current: 10, delta7d: null, delta30d: null },
  rankDistribution: { top1: 0, top3: 0, top10: 0, top50: 0, beyond: 0, unranked: 0 },
  movers: { up: [], down: [] },
  coverage: { inTitle: 0, inSubtitle: 0, inDescription: 0, uncoveredHighOpportunity: [] },
  lastRefreshAt: null,
  trackedKeywords: 0,
  competitors: 0,
};

export const APP_2_DETAIL: AppDetail = {
  id: "app-2",
  store: "APP_STORE",
  storeAppId: "987654321",
  country: "us",
  name: "Habit Tracker",
  iconUrl: null,
  createdAt: utcTimestampDaysAgo(20),
  latestSnapshot: {
    id: "snap-2",
    title: "Habit Tracker",
    subtitle: "Build better routines",
    summary: null,
    ratingAvg: 4.2,
    ratingCount: 800,
    installs: null,
    price: 0,
    version: "1.0.0",
    capturedAt: utcTimestampDaysAgo(1),
  },
  competitors: [],
};

export const APP_2: AppListItem = {
  id: "app-2",
  store: "APP_STORE",
  country: "us",
  name: "Habit Tracker",
  iconUrl: null,
  ratingAvg: 4.2,
  ratingCount: 800,
  capturedAt: utcTimestampDaysAgo(1),
  trackedKeywordCount: 0,
  competitorCount: 0,
};

export const IMPORTED_APP_DETAIL: AppDetail = {
  id: "app-new",
  store: "APP_STORE",
  storeAppId: "123456789",
  country: "us",
  name: "Imported App",
  iconUrl: null,
  createdAt: utcTimestampDaysAgo(0),
  latestSnapshot: null,
  competitors: [],
};

export const IMPORTED_APP: AppListItem = {
  id: "app-new",
  store: "APP_STORE",
  country: "us",
  name: "Imported App",
  iconUrl: null,
  ratingAvg: null,
  ratingCount: null,
  capturedAt: utcTimestampDaysAgo(0),
  trackedKeywordCount: 0,
  competitorCount: 0,
};

const EMPTY_RANKINGS: RankingSeries = { series: [] };
const EMPTY_VISIBILITY: VisibilityHistory = { points: [] };
const EMPTY_RANK_DISTRIBUTION_HISTORY: RankDistributionHistory = { points: [] };
const EMPTY_CATEGORY_RANKS: CategoryRankSeries = { series: [] };
const EMPTY_REVIEWS: ReviewList = { reviews: [], total: 0, versions: [] };
const EMPTY_RATINGS_HISTORY: RatingsHistory = { points: [] };
const EMPTY_SERP_MOVERS: SerpMovers = { windowDays: 7, items: [] };

export interface AppDataset {
  detail: AppDetail;
  summary: AppSummary;
  keywords: TrackedKeywordItem[];
  rankings: RankingSeries;
  serpMovers: SerpMovers;
  visibility: VisibilityHistory;
  rankDistributionHistory: RankDistributionHistory;
  categoryRanks: CategoryRankSeries;
  competitors: CompetitorItem[];
  reviews: ReviewList;
  ratingsHistory: RatingsHistory;
}

export const DATASETS: Record<string, AppDataset> = {
  "app-1": {
    detail: APP_1_DETAIL,
    summary: APP_1_SUMMARY,
    keywords: APP_1_KEYWORDS,
    rankings: APP_1_RANKINGS,
    serpMovers: APP_1_SERP_MOVERS,
    visibility: APP_1_VISIBILITY,
    rankDistributionHistory: APP_1_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: APP_1_CATEGORY_RANKS,
    competitors: APP_1_COMPETITORS,
    reviews: APP_1_REVIEWS,
    ratingsHistory: APP_1_RATINGS_HISTORY,
  },
  "app-2": {
    detail: APP_2_DETAIL,
    summary: APP_2_SUMMARY,
    keywords: [],
    rankings: EMPTY_RANKINGS,
    serpMovers: EMPTY_SERP_MOVERS,
    visibility: EMPTY_VISIBILITY,
    rankDistributionHistory: EMPTY_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: EMPTY_CATEGORY_RANKS,
    competitors: [],
    reviews: EMPTY_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
  },
  "app-new": {
    detail: IMPORTED_APP_DETAIL,
    summary: APP_2_SUMMARY,
    keywords: [],
    rankings: EMPTY_RANKINGS,
    serpMovers: EMPTY_SERP_MOVERS,
    visibility: EMPTY_VISIBILITY,
    rankDistributionHistory: EMPTY_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: EMPTY_CATEGORY_RANKS,
    competitors: [],
    reviews: EMPTY_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
  },
};

export const INITIAL_APPS: AppListItem[] = [APP_1, APP_2];

export const PORTFOLIO: PortfolioSummary = {
  apps: [
    {
      id: "app-1",
      store: "APP_STORE",
      country: "us",
      name: "Focus Timer",
      iconUrl: null,
      visibility: { current: 62.4, delta7d: 5 },
      sparkline: APP_1_VISIBILITY.points,
      trackedKeywords: 5,
      competitors: 1,
      lastCapturedAt: utcTimestampDaysAgo(0),
    },
    {
      id: "app-2",
      store: "APP_STORE",
      country: "us",
      name: "Habit Tracker",
      iconUrl: null,
      visibility: { current: 10, delta7d: null },
      sparkline: [],
      trackedKeywords: 0,
      competitors: 0,
      lastCapturedAt: utcTimestampDaysAgo(1),
    },
  ],
  totals: { apps: 2, competitors: 1, trackedKeywords: 5, changes7d: 3 },
};

export const APP_1_KEYWORD_COUNTRIES: KeywordCountrySummary[] = [
  { country: "us", keywordCount: APP_1_KEYWORDS.length },
  { country: "pl", keywordCount: 0 },
];

export const BUDGET: DailyBudget = {
  apps: 3,
  keywords: 12,
  categories: 4,
  reviews: 2,
  total: 21,
  capacityPerDay: 21600,
  utilization: 0.001,
};

export const RECENT_CHANGES: ChangeTimeline = {
  events: [
    {
      id: "chg-1",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "title",
      before: "Focus Timer",
      after: "Focus Timer Pro",
      capturedAt: utcTimestampDaysAgo(1),
    },
    {
      id: "chg-2",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "subtitle",
      before: "Deep work timer",
      after: "Deep focus timer",
      capturedAt: utcTimestampDaysAgo(2),
    },
  ],
};

export const EMAIL_ALERTS: EmailAlertItem[] = [
  {
    id: "email-1",
    email: "ops@example.com",
    events: ["metadata.changed", "rank.dropped"],
    active: true,
    createdAt: utcTimestampDaysAgo(3),
  },
];

export const EMAIL_DELIVERIES: AlertDeliveryItem[] = [
  {
    id: "del-1",
    channel: "email",
    event: "rank.dropped",
    status: "failed",
    detail: "smtp timeout",
    attempt: 2,
    createdAt: utcTimestampDaysAgo(1),
  },
  {
    id: "del-2",
    channel: "email",
    event: "metadata.changed",
    status: "success",
    detail: null,
    attempt: 1,
    createdAt: utcTimestampDaysAgo(2),
  },
];

export const IMPORTED_PORTFOLIO_APP: PortfolioSummary["apps"][number] = {
  id: "app-new",
  store: "APP_STORE",
  country: "us",
  name: "Imported App",
  iconUrl: null,
  visibility: { current: 0, delta7d: null },
  sparkline: [],
  trackedKeywords: 0,
  competitors: 0,
  lastCapturedAt: null,
};

export function errorEnvelope(statusCode: number, path: string): ApiErrorEnvelope {
  const errors: Record<number, string> = {
    404: "Not Found",
    500: "Internal Server Error",
    501: "Not Implemented",
  };
  return {
    statusCode,
    error: errors[statusCode] ?? "Error",
    message:
      statusCode === 404
        ? "The requested resource was not found."
        : statusCode === 501
          ? "Google Play is not supported yet."
          : "The server encountered an unexpected error.",
    path,
    timestamp: new Date().toISOString(),
  };
}
