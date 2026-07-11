import {
  KEYWORD_SORTS,
  KEYWORD_SUGGESTION_STRATEGIES,
} from "@asobeast/shared";
import {
  createParser,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import {
  CHANGE_WINDOWS,
  DISCOVERY_WINDOWS,
  RANGE_PRESETS,
  VISIBILITY_RANGES,
  type ChangeWindow,
  type DiscoveryWindow,
} from "./ranges";

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

export const serpParser = parseAsString.withDefault("");

export const discoveryDaysParser = createParser({
  parse(value) {
    const days = Number(value);
    return (DISCOVERY_WINDOWS as readonly number[]).includes(days)
      ? (days as DiscoveryWindow)
      : null;
  },
  serialize(value: DiscoveryWindow) {
    return String(value);
  },
}).withDefault(30);

export const changeDaysParser = createParser({
  parse(value) {
    const days = Number(value);
    return (CHANGE_WINDOWS as readonly number[]).includes(days)
      ? (days as ChangeWindow)
      : null;
  },
  serialize(value: ChangeWindow) {
    return String(value);
  },
}).withDefault(90);
