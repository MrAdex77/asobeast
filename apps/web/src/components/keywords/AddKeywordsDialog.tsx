"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeText, type TrackedKeywordItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { addKeywords, ApiError } from "@/lib/api";
import { appKeys, invalidateKeywordMutation } from "@/lib/queries";

function parseKeywords(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of input.split(/[,\n]/)) {
    const text = normalizeText(part);
    if (text && !seen.has(text)) {
      seen.add(text);
      result.push(text);
    }
  }
  return result;
}

export function AddKeywordsDialog({
  appId,
  children,
}: {
  appId: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chips = useMemo(() => parseKeywords(raw), [raw]);

  const mutation = useMutation({
    mutationFn: (list: string[]) => addKeywords(appId, list),
    onSuccess: (_tracked, list) => {
      const before = new Set(
        queryClient
          .getQueriesData<TrackedKeywordItem[]>({
            queryKey: appKeys.keywordsRoot(appId),
          })
          .flatMap(([, rows]) => rows?.map((row) => row.text) ?? []),
      );
      const added = list.filter((text) => !before.has(text)).length;
      const duplicates = list.length - added;
      invalidateKeywordMutation(queryClient, appId);
      setOpen(false);
      toast.success(`Tracking ${added} keyword${added === 1 ? "" : "s"}`, {
        description:
          duplicates > 0
            ? `${duplicates} already tracked`
            : "Rankings capture on the next run.",
      });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.envelope.message : "Could not add keywords",
      ),
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setRaw("");
      setError(null);
      mutation.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add keywords</DialogTitle>
          <DialogDescription>
            Separate phrases with commas or new lines. Each is normalized to
            lowercase and de-duplicated before tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
              setError(null);
            }}
            rows={4}
            placeholder="fitness tracker, workout log"
            autoFocus
            aria-invalid={error !== null}
          />
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <Badge key={chip} variant="secondary">
                  {chip}
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground tabular-nums">
            {chips.length} keyword{chips.length === 1 ? "" : "s"} ready
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            disabled={mutation.isPending || chips.length === 0}
            onClick={() => {
              setError(null);
              mutation.mutate(chips);
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {mutation.isPending ? "Adding…" : "Add keywords"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
