"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { useQueryState } from "nuqs";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate, formatPosition } from "@/lib/format";
import { keywordsOptions } from "@/lib/queries";
import { sortParser } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { SourceBadge } from "./SourceBadge";

const SORT_COLUMNS: { key: KeywordSort; label: string; emphasize?: boolean }[] =
  [
    { key: "position", label: "Position" },
    { key: "traffic", label: "Traffic" },
    { key: "difficulty", label: "Difficulty" },
    { key: "opportunity", label: "Opportunity", emphasize: true },
  ];

function scoreValue(keyword: TrackedKeywordItem, column: KeywordSort): number | null {
  switch (column) {
    case "traffic":
      return keyword.volume;
    case "difficulty":
      return keyword.difficulty === null ? null : keyword.difficulty * 10;
    case "opportunity":
      return keyword.opportunity;
    default:
      return null;
  }
}

function DeltaChip({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (value === 0) {
    return <span className="text-muted-foreground tabular-nums">0</span>;
  }
  const improved = value < 0;
  const Icon = improved ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular-nums",
        improved
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      )}
    >
      <Icon className="size-3.5" />
      {Math.abs(value)}
    </span>
  );
}

function ScoreCell({
  value,
  scoredAt,
  emphasize,
}: {
  value: number | null;
  scoredAt: string | null;
  emphasize?: boolean;
}) {
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground">—</span>
        </TooltipTrigger>
        <TooltipContent>Not scored yet</TooltipContent>
      </Tooltip>
    );
  }
  const label = (
    <span
      className={cn(
        "tabular-nums",
        emphasize ? "font-semibold text-foreground" : "text-muted-foreground",
      )}
    >
      {Math.round(value)}
    </span>
  );
  if (!scoredAt) {
    return label;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent>Scored {formatDate(scoredAt)}</TooltipContent>
    </Tooltip>
  );
}

function SortHeader({
  column,
  label,
  active,
  onSort,
}: {
  column: KeywordSort;
  label: string;
  active: boolean;
  onSort: (column: KeywordSort) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 transition-colors",
        active ? "text-foreground" : "hover:text-foreground",
      )}
    >
      {label}
      {active ? <ChevronDown className="size-3.5" /> : null}
    </button>
  );
}

export function KeywordsTable({ id }: { id: string }) {
  const [sort, setSort] = useQueryState("sort", sortParser);
  const { data: keywords } = useSuspenseQuery(keywordsOptions(id, sort));

  const activeCount = keywords.filter((keyword) => keyword.active).length;

  if (keywords.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No tracked keywords yet. Add keywords or track a suggestion below to
        start capturing rankings.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Tracking{" "}
          <span className="font-medium text-foreground tabular-nums">
            {keywords.length}
          </span>{" "}
          keyword{keywords.length === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-foreground tabular-nums">
            {activeCount}
          </span>{" "}
          active
        </p>

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Source</TableHead>
                {SORT_COLUMNS.map((column) => (
                  <TableHead key={column.key}>
                    <SortHeader
                      column={column.key}
                      label={column.label}
                      active={sort === column.key}
                      onSort={setSort}
                    />
                  </TableHead>
                ))}
                <TableHead>Δ7d</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.map((keyword) => (
                <TableRow
                  key={keyword.keywordId}
                  className={cn(!keyword.active && "opacity-55")}
                >
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {keyword.text}
                      {!keyword.active ? (
                        <Badge variant="secondary">Paused</Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={keyword.source} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <span
                      className={cn(
                        keyword.latestPosition === null &&
                          "text-muted-foreground",
                      )}
                    >
                      {formatPosition(keyword.latestPosition)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ScoreCell
                      value={scoreValue(keyword, "traffic")}
                      scoredAt={keyword.scoredAt}
                    />
                  </TableCell>
                  <TableCell>
                    <ScoreCell
                      value={scoreValue(keyword, "difficulty")}
                      scoredAt={keyword.scoredAt}
                    />
                  </TableCell>
                  <TableCell>
                    <ScoreCell
                      value={scoreValue(keyword, "opportunity")}
                      scoredAt={keyword.scoredAt}
                      emphasize
                    />
                  </TableCell>
                  <TableCell>
                    <DeltaChip value={keyword.positionDelta7d} />
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
