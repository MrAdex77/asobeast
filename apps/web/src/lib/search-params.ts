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
import { RANGE_PRESETS, VISIBILITY_RANGES } from "./ranges";

export const sortParser = parseAsStringLiteral(KEYWORD_SORTS).withDefault(
  "opportunity",
);

export const rangeParser =
  parseAsStringLiteral(RANGE_PRESETS).withDefault("30d");

export const visibilityRangeParser =
  parseAsStringLiteral(VISIBILITY_RANGES).withDefault("30d");

export const keywordIdsParser = parseAsArrayOf(parseAsString).withDefault([]);

export const onlyGapsParser = parseAsBoolean.withDefault(false);

export const suggestionStrategyParser = parseAsStringLiteral(
  KEYWORD_SUGGESTION_STRATEGIES,
).withDefault("metadata");
