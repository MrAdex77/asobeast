import {
  KEYWORD_SORTS,
  KEYWORD_SUGGESTION_STRATEGIES,
} from "@asobeast/shared";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";

export const RANGE_PRESETS = ["7d", "30d", "90d"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const sortParser = parseAsStringLiteral(KEYWORD_SORTS).withDefault(
  "opportunity",
);

export const rangeParser =
  parseAsStringLiteral(RANGE_PRESETS).withDefault("30d");

export const keywordIdsParser = parseAsArrayOf(parseAsString).withDefault([]);

export const onlyGapsParser = parseAsBoolean.withDefault(false);

export const suggestionStrategyParser = parseAsStringLiteral(
  KEYWORD_SUGGESTION_STRATEGIES,
).withDefault("metadata");
