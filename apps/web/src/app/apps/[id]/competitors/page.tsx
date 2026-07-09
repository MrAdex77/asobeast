import { notFound } from "next/navigation";
import type {
  CompetitorGapKeyword,
  CompetitorMetadataRow,
  PositionMapPoint,
} from "@asobeast/shared";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ApiError, getCompetitorAnalysis } from "@/lib/api";

function num(value: number | null): string {
  return value === null ? "—" : String(Math.round(value));
}

function GapTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: CompetitorGapKeyword[];
  columns: { label: string; value: (row: CompetitorGapKeyword) => string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No keywords.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Keyword</th>
                {columns.map((column) => (
                  <th key={column.label} className="px-4 py-2 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {rows.map((row) => (
                <tr key={row.keywordId}>
                  <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">
                    {row.text}
                  </td>
                  {columns.map((column) => (
                    <td key={column.label} className="px-4 py-2 tabular-nums">
                      {column.value(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PositionMap({ points }: { points: PositionMapPoint[] }) {
  const width = 440;
  const height = 260;
  const pad = 36;
  const x = (visibility: number) => pad + (visibility / 100) * (width - 2 * pad);
  const y = (rating: number | null) =>
    pad + (1 - (rating ?? 0) / 5) * (height - 2 * pad);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full text-zinc-400"
        role="img"
        aria-label="Visibility versus rating position map"
      >
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          className="stroke-zinc-300 dark:stroke-zinc-700"
        />
        <line
          x1={pad}
          y1={pad}
          x2={pad}
          y2={height - pad}
          className="stroke-zinc-300 dark:stroke-zinc-700"
        />
        <text x={width - pad} y={height - pad + 16} textAnchor="end" className="fill-current text-[10px]">
          visibility →
        </text>
        <text x={pad - 8} y={pad} textAnchor="end" className="fill-current text-[10px]">
          rating
        </text>
        {points.map((point) => (
          <g key={point.appId}>
            <circle
              cx={x(point.visibility)}
              cy={y(point.ratingAvg)}
              r={point.isYou ? 7 : 5}
              className={
                point.isYou
                  ? "fill-emerald-500"
                  : "fill-zinc-400 dark:fill-zinc-500"
              }
            />
            <text
              x={x(point.visibility) + 10}
              y={y(point.ratingAvg) + 4}
              className="fill-zinc-600 text-[10px] dark:fill-zinc-300"
            >
              {point.name ?? "app"}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function MetadataComparison({ rows }: { rows: CompetitorMetadataRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2 font-medium">App</th>
            <th className="px-4 py-2 font-medium">Title</th>
            <th className="px-4 py-2 font-medium">Subtitle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {rows.map((row) => (
            <tr key={row.appId}>
              <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">
                <span className="flex items-center gap-2">
                  {row.name ?? "Untitled"}
                  {row.isYou ? <Badge tone="info">you</Badge> : null}
                </span>
              </td>
              <td className="px-4 py-2">
                {row.title ?? "—"}
                <span className="ml-1 text-xs text-zinc-400">
                  {row.titleChars}/30
                </span>
              </td>
              <td className="px-4 py-2">
                {row.subtitle ?? "—"}
                <span className="ml-1 text-xs text-zinc-400">
                  {row.subtitleChars}/30
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const analysis = await getCompetitorAnalysis(id).catch((err) => {
    if (err instanceof ApiError && err.envelope.statusCode === 404) notFound();
    return null;
  });
  if (!analysis) {
    return (
      <Card className="border-dashed">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Competitor analysis is not available for this app yet.
        </p>
      </Card>
    );
  }

  if (analysis.metadataComparison.length <= 1) {
    return (
      <EmptyState
        title="No competitors"
        description="Add competitor apps to compare metadata, keyword gaps and positioning."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Metadata comparison</h2>
        <MetadataComparison rows={analysis.metadataComparison} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Keyword gaps</h2>
        <GapTable
          title="They rank, you don't"
          rows={analysis.gaps.theyRankYouDont}
          columns={[
            { label: "Volume", value: (r) => num(r.volume) },
            { label: "Difficulty", value: (r) => num(r.difficulty) },
            { label: "Best comp.", value: (r) => num(r.bestCompetitorPosition) },
            { label: "Opportunity", value: (r) => num(r.opportunity) },
          ]}
        />
        <GapTable
          title="You rank, they don't (protect these)"
          rows={analysis.gaps.youRankTheyDont}
          columns={[{ label: "Your rank", value: (r) => num(r.yourPosition) }]}
        />
        <GapTable
          title="Outranked"
          rows={analysis.gaps.outranked}
          columns={[
            { label: "You", value: (r) => num(r.yourPosition) },
            { label: "Best comp.", value: (r) => num(r.bestCompetitorPosition) },
            { label: "Gap", value: (r) => num(r.gap) },
          ]}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Position map</h2>
        <PositionMap points={analysis.positionMap} />
      </section>
    </div>
  );
}
