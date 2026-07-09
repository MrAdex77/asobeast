"use client";

import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, runDaily } from "@/lib/api";
import { appKeys } from "@/lib/queries";

export function RunDailyAction({ appId }: { appId: string }) {
  const queryClient = useQueryClient();
  const busy = useIsMutating({ mutationKey: ["app-action", appId] }) > 0;

  const mutation = useMutation({
    mutationKey: ["app-action", appId, "run-daily"],
    mutationFn: () => runDaily(appId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: appKeys.detail(appId) });
      const count = result.enqueued.keywords;
      toast.success(
        `Queued rank checks for ${count} keyword${count === 1 ? "" : "s"}`,
        {
          description:
            "Results land as the rate-limited worker runs (~15 searches/minute).",
        },
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.envelope.message : "Run daily failed",
      );
    },
  });

  return (
    <Button variant="outline" disabled={busy} onClick={() => mutation.mutate()}>
      {mutation.isPending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <CalendarClock />
      )}
      Run daily
    </Button>
  );
}
