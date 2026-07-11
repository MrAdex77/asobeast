export const CATEGORY_COLLECTIONS = ['free', 'paid', 'grossing'] as const;
export type CategoryCollection = (typeof CATEGORY_COLLECTIONS)[number];

export const OVERALL_GENRE_ID = 0;

export interface CategoryRankPoint {
  date: string;
  position: number | null;
}

export interface CategoryRankSeriesItem {
  collection: CategoryCollection;
  genreId: number;
  genreName: string;
  current: number | null;
  points: CategoryRankPoint[];
}

export interface CategoryRankSeries {
  series: CategoryRankSeriesItem[];
}
