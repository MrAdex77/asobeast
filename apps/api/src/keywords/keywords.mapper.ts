import { KeywordMetric, KeywordRanking } from '@prisma/client';
import { TrackedKeywordItem } from '@asobeast/shared';

const DELTA_WINDOW_DAYS = 7;

export interface TrackedKeywordRow {
  keywordId: string;
  source: TrackedKeywordItem['source'];
  active: boolean;
  keyword: {
    text: string;
    rankings: Pick<KeywordRanking, 'position' | 'date'>[];
    metrics: Pick<KeywordMetric, 'traffic' | 'difficulty'>[];
  };
}

function positionDelta7d(
  rankings: Pick<KeywordRanking, 'position' | 'date'>[],
): number | null {
  const latest = rankings[0];
  if (!latest || latest.position === null) {
    return null;
  }
  const cutoff = new Date(latest.date);
  cutoff.setUTCDate(cutoff.getUTCDate() - DELTA_WINDOW_DAYS);
  const past = rankings.find(
    (ranking) => ranking.date <= cutoff && ranking.position !== null,
  );
  if (!past || past.position === null) {
    return null;
  }
  return latest.position - past.position;
}

export function toTrackedKeywordItem(
  row: TrackedKeywordRow,
): TrackedKeywordItem {
  const latest = row.keyword.rankings[0] ?? null;
  const metric = row.keyword.metrics[0] ?? null;
  return {
    keywordId: row.keywordId,
    text: row.keyword.text,
    source: row.source,
    active: row.active,
    latestPosition: latest?.position ?? null,
    positionDelta7d: positionDelta7d(row.keyword.rankings),
    traffic: metric?.traffic ?? null,
    difficulty: metric?.difficulty ?? null,
    opportunity: null,
  };
}
