import { Store } from '../index';

export type AuditCheckKind = 'auto' | 'heuristic' | 'manual';
export type AuditCheckStatus = 'pass' | 'warn' | 'fail' | 'unanswered';

export interface AuditCheckResult {
  id: string;
  label: string;
  kind: AuditCheckKind;
  status: AuditCheckStatus;
  score: number | null;
  detail: string;
}

export interface AuditFactorResult {
  id: string;
  label: string;
  weight: number;
  score: number | null;
  checks: AuditCheckResult[];
  needsInput: boolean;
}

export interface AuditRecommendation {
  factorId: string;
  checkId: string;
  label: string;
  detail: string;
}

export interface AuditRecommendations {
  quickWins: AuditRecommendation[];
  highImpact: AuditRecommendation[];
  strategic: AuditRecommendation[];
}

export interface AppAuditResult {
  appId: string;
  store: Store;
  overall: number | null;
  coveredWeight: number;
  totalWeight: number;
  factors: AuditFactorResult[];
  recommendations: AuditRecommendations;
  generatedAt: string;
}

export interface AuditScorePoint {
  date: string;
  overall: number | null;
  coveredWeight: number;
  totalWeight: number;
}

export interface AuditHistory {
  points: AuditScorePoint[];
}

export interface AuditInputAnswers {
  screenshotsFirst3Compelling?: boolean;
  screenshotsTextOverlays?: boolean;
  screenshotsConsistent?: boolean;
  screenshotsLocalized?: boolean;
  screenshotsDeviceFrames?: boolean;
  previewVideoExists?: boolean;
  previewVideoHook?: boolean;
  previewVideoLength?: boolean;
  previewVideoWorksWithoutSound?: boolean;
  reviewResponses?: boolean;
  ratingPrompts?: boolean;
  iconDistinctive?: boolean;
  iconSimple?: boolean;
  iconCategoryFit?: boolean;
  iconNoText?: boolean;
  promotionalText?: boolean;
  inAppEvents?: boolean;
  customProductPages?: boolean;
}
