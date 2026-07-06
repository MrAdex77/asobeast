export interface RankingPoint {
  date: string;
  position: number | null;
}

export interface RankingSeriesItem {
  keywordId: string;
  text: string;
  points: RankingPoint[];
}

export interface RankingSeries {
  series: RankingSeriesItem[];
}
