export interface SerpEntryItem {
  position: number;
  storeAppId: string;
  title: string;
  developer: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  appId: string | null;
  isCompetitor: boolean;
}

export interface SerpSnapshot {
  keywordId: string;
  text: string;
  date: string | null;
  entries: SerpEntryItem[];
}

export interface CompetitorDiscoveryItem {
  storeAppId: string;
  title: string;
  developer: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  appearances: number;
  keywordCount: number;
  bestPosition: number;
  avgPosition: number;
  keywords: string[];
}

export interface CompetitorDiscovery {
  windowDays: number;
  items: CompetitorDiscoveryItem[];
}
