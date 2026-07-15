import { KeywordBucket, Store } from '../index';
import { LintIssue } from '../aso/lint';
import { MetadataField } from '../aso/limits';

export interface MetadataFieldAudit {
  field: MetadataField;
  value: string | null;
  chars: number;
  limit: number;
  indexed: boolean;
  issues: LintIssue[];
}

export interface CoverageFieldStatus {
  field: MetadataField;
  covered: boolean;
}

export interface KeywordCoverageRow {
  keywordId: string;
  text: string;
  bucket: KeywordBucket | null;
  fields: CoverageFieldStatus[];
  uncovered: boolean;
}

export interface KeywordFieldSuggestion {
  value: string;
  charactersUsed: number;
  charactersLimit: number;
  addedTerms: string[];
}

export interface MetadataAuditResult {
  appId: string;
  store: Store;
  fields: MetadataFieldAudit[];
  coverage: KeywordCoverageRow[];
  keywordFieldSuggestion: KeywordFieldSuggestion | null;
}
