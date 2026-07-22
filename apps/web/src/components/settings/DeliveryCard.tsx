"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { flushAlerts } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { alertDeliveryKey, alertDeliveryOptions } from "@/lib/queries";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

export function DeliveryCard() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(alertDeliveryOptions);

  const flush = useMutation({
    mutationFn: flushAlerts,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: alertDeliveryKey });
      toast.success(
        result.flushed === 0
          ? "Nothing to flush"
          : `Flushed ${result.flushed} event${result.flushed === 1 ? "" : "s"} to ${result.channels} channel${result.channels === 1 ? "" : "s"}`,
      );
    },
    onError: () => toast.error("Could not flush alerts"),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Alerts</CardDescription>
          <CardTitle>Delivery</CardTitle>
        </div>
        <Button
          size="sm"
          disabled={flush.isPending}
          onClick={() => flush.mutate()}
        >
          {flush.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          Flush now
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {data.mode === "batched"
            ? "Events are collected and sent as one grouped notification per flush."
            : "Each event is delivered instantly, one notification per event."}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Mode">
            <Badge variant={data.mode === "batched" ? "default" : "outline"}>
              {data.mode === "batched" ? "Batched" : "Instant"}
            </Badge>
          </Field>
          <Field label="Schedule">
            <code className="font-mono text-xs">{data.cron}</code>
          </Field>
          <Field label="Last flush">
            {data.lastFlushAt ? formatDateTime(data.lastFlushAt) : "Never"}
          </Field>
          <Field label="Pending">{data.pending}</Field>
        </div>
      </CardContent>
    </Card>
  );
}
