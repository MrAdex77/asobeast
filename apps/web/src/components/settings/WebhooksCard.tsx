"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { KeyRound, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { WEBHOOK_EVENTS } from "@asobeast/shared";
import type { WebhookEvent, WebhookItem } from "@asobeast/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  ApiError,
  createWebhook,
  deleteWebhook,
  testWebhook,
  updateWebhook,
} from "@/lib/api";
import { invalidateWebhookMutation, webhooksOptions } from "@/lib/queries";

const EVENT_LABELS: Record<WebhookEvent, string> = {
  "metadata.changed": "Metadata changed",
  "rank.dropped": "Rank dropped",
  "rank.improved": "Rank improved",
  "review.negative": "Negative review",
  "digest.weekly": "Weekly digest",
};

function EventToggles({
  value,
  onChange,
}: {
  value: WebhookEvent[];
  onChange: (next: WebhookEvent[]) => void;
}) {
  function toggle(event: WebhookEvent) {
    onChange(
      value.includes(event)
        ? value.filter((item) => item !== event)
        : [...value, event],
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {WEBHOOK_EVENTS.map((event) => {
        const active = value.includes(event);
        return (
          <Button
            key={event}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            aria-pressed={active}
            onClick={() => toggle(event)}
          >
            {EVENT_LABELS[event]}
          </Button>
        );
      })}
    </div>
  );
}

function AddWebhookDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["metadata.changed"]);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createWebhook({
        url,
        events,
        secret: secret.trim() === "" ? undefined : secret,
      }),
    onSuccess: () => {
      invalidateWebhookMutation(queryClient);
      toast.success("Webhook added");
      setOpen(false);
      setUrl("");
      setEvents(["metadata.changed"]);
      setSecret("");
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.envelope.message : "Could not add webhook",
      );
    },
  });

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error();
      }
    } catch {
      setError("Enter a valid http(s) URL");
      return;
    }
    if (events.length === 0) {
      setError("Select at least one event");
      return;
    }
    if (secret.trim() !== "" && secret.length < 8) {
      setError("Secret must be at least 8 characters");
      return;
    }

    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add webhook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add webhook</DialogTitle>
            <DialogDescription>
              asobeast POSTs a JSON payload to this URL when a subscribed event
              fires. Add a secret to receive an HMAC signature header.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://hooks.example.com/asobeast"
              aria-invalid={error !== null}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Events</Label>
            <EventToggles value={events} onChange={setEvents} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook-secret">Secret (optional)</Label>
            <Input
              id="webhook-secret"
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Add webhook
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WebhookRow({ webhook }: { webhook: WebhookItem }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateWebhook(webhook.id, { active }),
    onSuccess: () => invalidateWebhookMutation(queryClient),
    onError: () => toast.error("Could not update webhook"),
  });

  const test = useMutation({
    mutationFn: () => testWebhook(webhook.id),
    onSuccess: (result) => {
      if (result.delivered) {
        toast.success(`Delivered (status ${result.status ?? "—"})`);
      } else {
        toast.error(
          `Not delivered${result.status !== null ? ` (status ${result.status})` : ""}`,
        );
      }
    },
    onError: () => toast.error("Could not reach the webhook"),
  });

  const remove = useMutation({
    mutationFn: () => deleteWebhook(webhook.id),
    onSuccess: () => {
      invalidateWebhookMutation(queryClient);
      setConfirmOpen(false);
      toast.success("Webhook removed");
    },
    onError: () => toast.error("Could not remove webhook"),
  });

  return (
    <TableRow>
      <TableCell className="max-w-[18rem] truncate font-medium">
        {webhook.url}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {webhook.events.map((event) => (
            <Badge key={event} variant="outline">
              {EVENT_LABELS[event]}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        {webhook.hasSecret ? (
          <Badge variant="secondary">
            <KeyRound />
            Signed
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Switch
          checked={webhook.active}
          disabled={toggle.isPending}
          aria-label={`Toggle ${webhook.url}`}
          onCheckedChange={(active) => toggle.mutate(active)}
        />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={test.isPending}
            onClick={() => test.mutate()}
          >
            {test.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Send test
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${webhook.url}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
          </Button>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this webhook?</AlertDialogTitle>
              <AlertDialogDescription>
                asobeast will stop delivering alerts to {webhook.url}. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={remove.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={remove.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  remove.mutate();
                }}
              >
                {remove.isPending ? "Removing…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

export function WebhooksCard() {
  const { data } = useSuspenseQuery(webhooksOptions);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Alerts</CardDescription>
          <CardTitle>Webhooks</CardTitle>
        </div>
        <AddWebhookDialog />
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No webhooks yet. Add one to receive metadata and rank alerts in
            Slack, Discord, ntfy or your own endpoint.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableCaption className="sr-only">
                Configured alert webhooks and their subscribed events.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Secret</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((webhook) => (
                  <WebhookRow key={webhook.id} webhook={webhook} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
