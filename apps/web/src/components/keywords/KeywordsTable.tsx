"use client";

import { useEffect, useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ChevronDown, ListOrdered } from "lucide-react";
import { useQueryState } from "nuqs";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCaption,
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
import { serpParser, sortParser } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { DeltaChip, PositionDeltaChip } from "./DeltaChip";
import { KeywordRowActions } from "./KeywordRowActions";
import { KeywordsBulkActions } from "./KeywordsBulkActions";
import { SerpSheet } from "./SerpSheet";
import { SourceBadge } from "./SourceBadge";

function scoreValue(
  keyword: TrackedKeywordItem,
  column: KeywordSort,
): number | null {
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

const columnHelper = createColumnHelper<TrackedKeywordItem>();

export function KeywordsTable({ id }: { id: string }) {
  const [sort, setSort] = useQueryState("sort", sortParser);
  const [, setSerp] = useQueryState("serp", serpParser);
  const { data: keywords } = useSuspenseQuery(keywordsOptions(id, sort));
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
            aria-label="Select all keywords"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.text}`}
          />
        ),
      }),
      columnHelper.accessor("text", {
        header: "Keyword",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2 font-medium">
            {row.original.text}
            {!row.original.active ? (
              <Badge variant="secondary">Paused</Badge>
            ) : null}
          </span>
        ),
      }),
      columnHelper.accessor("source", {
        header: "Source",
        cell: ({ row }) => <SourceBadge source={row.original.source} />,
      }),
      columnHelper.accessor("latestPosition", {
        header: () => (
          <SortHeader
            column="position"
            label="Position"
            active={sort === "position"}
            onSort={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <span
              className={cn(
                row.original.latestPosition === null && "text-muted-foreground",
              )}
            >
              {formatPosition(row.original.latestPosition)}
            </span>
            <PositionDeltaChip value={row.original.positionDelta1d} />
          </span>
        ),
      }),
      columnHelper.display({
        id: "traffic",
        header: () => (
          <SortHeader
            column="traffic"
            label="Traffic"
            active={sort === "traffic"}
            onSort={setSort}
          />
        ),
        cell: ({ row }) => (
          <ScoreCell
            value={scoreValue(row.original, "traffic")}
            scoredAt={row.original.scoredAt}
          />
        ),
      }),
      columnHelper.display({
        id: "difficulty",
        header: () => (
          <SortHeader
            column="difficulty"
            label="Difficulty"
            active={sort === "difficulty"}
            onSort={setSort}
          />
        ),
        cell: ({ row }) => (
          <ScoreCell
            value={scoreValue(row.original, "difficulty")}
            scoredAt={row.original.scoredAt}
          />
        ),
      }),
      columnHelper.display({
        id: "opportunity",
        header: () => (
          <SortHeader
            column="opportunity"
            label="Opportunity"
            active={sort === "opportunity"}
            onSort={setSort}
          />
        ),
        cell: ({ row }) => (
          <ScoreCell
            value={scoreValue(row.original, "opportunity")}
            scoredAt={row.original.scoredAt}
            emphasize
          />
        ),
      }),
      columnHelper.accessor("positionDelta7d", {
        header: "Δ7d",
        cell: ({ row }) => <DeltaChip value={row.original.positionDelta7d} />,
      }),
      columnHelper.display({
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`View top 10 for ${row.original.text}`}
              onClick={() => void setSerp(row.original.keywordId)}
            >
              <ListOrdered />
            </Button>
            <KeywordRowActions appId={id} keyword={row.original} />
          </div>
        ),
      }),
    ],
    [id, sort, setSort, setSerp],
  );

  const table = useReactTable({
    data: keywords,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.keywordId,
    manualSorting: true,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    const ids = new Set(keywords.map((keyword) => keyword.keywordId));
    setRowSelection((prev) => {
      let changed = false;
      const next: RowSelectionState = {};
      for (const key of Object.keys(prev)) {
        if (ids.has(key)) {
          next[key] = prev[key];
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [keywords]);

  const activeCount = keywords.filter((keyword) => keyword.active).length;
  const selectedIds = Object.keys(rowSelection).filter(
    (key) => rowSelection[key],
  );

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

        {selectedIds.length > 0 ? (
          <KeywordsBulkActions
            appId={id}
            selectedIds={selectedIds}
            onClear={() => setRowSelection({})}
          />
        ) : null}

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableCaption className="sr-only">
              Tracked keywords with source, position and its daily change,
              traffic, difficulty, opportunity and 7 day change.
            </TableCaption>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.column.id === "select" && "w-0",
                        header.column.id === "actions" && "w-0",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(!row.original.active && "opacity-55")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <SerpSheet appId={id} />
    </TooltipProvider>
  );
}
