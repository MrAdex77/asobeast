import type { KeywordBucket } from "@asobeast/shared";
import { Badge, type BadgeTone } from "./Badge";

const TONE: Record<KeywordBucket, BadgeTone> = {
  primary: "success",
  secondary: "info",
  longtail: "neutral",
  aspirational: "warning",
};

export function BucketBadge({ bucket }: { bucket: KeywordBucket | null }) {
  if (!bucket) {
    return <span className="text-zinc-400">—</span>;
  }
  return <Badge tone={TONE[bucket]}>{bucket}</Badge>;
}
