"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { ReviewItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { reviewsOptions } from "@/lib/queries";
import { reviewScoreParser, reviewVersionParser } from "@/lib/search-params";
import { ReviewsListSkeleton } from "./skeletons";

const STAR_FILTERS = [5, 4, 3, 2, 1] as const;
const LOW_SCORE = 2;

function Stars({ score }: { score: number }) {
  const low = score <= LOW_SCORE;
  return (
    <span
      className={cn(
        "text-sm tracking-tight",
        low ? "text-destructive" : "text-foreground",
      )}
      aria-label={`${score} out of 5 stars`}
    >
      <span aria-hidden>
        {"★".repeat(score)}
        <span className="text-muted-foreground">
          {"☆".repeat(5 - score)}
        </span>
      </span>
    </span>
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  const low = review.score <= LOW_SCORE;
  return (
    <article
      className={cn(
        "flex flex-col gap-2 border-l-2 py-3 pl-4",
        low ? "border-destructive/60" : "border-transparent",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Stars score={review.score} />
        {review.title ? (
          <span className="text-sm font-medium">{review.title}</span>
        ) : null}
        {review.version ? (
          <Badge variant="outline">v{review.version}</Badge>
        ) : null}
      </div>
      <p className="text-sm break-words whitespace-pre-line">{review.text}</p>
      <p className="text-xs text-muted-foreground">
        {review.userName ?? "Anonymous"} · {formatDate(review.reviewedAt)}
      </p>
    </article>
  );
}

function ReviewCards({
  id,
  score,
  version,
}: {
  id: string;
  score: number | null;
  version: string;
}) {
  const { data } = useSuspenseQuery(
    reviewsOptions(id, {
      score: score ?? undefined,
      version: version || undefined,
    }),
  );

  if (data.total === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No reviews stored yet — reviews appear after the next daily sync.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {data.reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}

function VersionSelect({
  id,
  version,
  onChange,
}: {
  id: string;
  version: string;
  onChange: (next: string) => void;
}) {
  const { data } = useSuspenseQuery(reviewsOptions(id, {}));

  return (
    <Select
      value={version || "all"}
      onValueChange={(next) => onChange(next === "all" ? "" : next)}
    >
      <SelectTrigger className="w-[140px]" aria-label="Filter by version">
        <SelectValue placeholder="All versions" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All versions</SelectItem>
        {data.versions.map((item) => (
          <SelectItem key={item} value={item}>
            v{item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ReviewsList({ id }: { id: string }) {
  const [score, setScore] = useQueryState("score", reviewScoreParser);
  const [version, setVersion] = useQueryState("version", reviewVersionParser);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Reviews</CardDescription>
          <CardTitle>User reviews</CardTitle>
        </div>
        <Suspense fallback={null}>
          <VersionSelect id={id} version={version} onChange={setVersion} />
        </Suspense>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by star rating">
          {STAR_FILTERS.map((star) => (
            <Button
              key={star}
              size="sm"
              variant={score === star ? "default" : "outline"}
              aria-pressed={score === star}
              onClick={() => void setScore(score === star ? null : star)}
            >
              {star}
              <span aria-hidden>{"★"}</span>
            </Button>
          ))}
        </div>
        <Suspense fallback={<ReviewsListSkeleton />}>
          <ReviewCards id={id} score={score} version={version} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
