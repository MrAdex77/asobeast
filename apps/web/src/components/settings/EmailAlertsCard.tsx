"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { EmailAlertItem, WebhookEvent } from "@asobeast/shared";
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
  createEmailAlert,
  deleteEmailAlert,
  testEmailAlert,
  updateEmailAlert,
} from "@/lib/api";
import {
  alertsConfigOptions,
  emailAlertsOptions,
  invalidateEmailAlertMutation,
} from "@/lib/queries";
import { EVENT_LABELS, EventToggles } from "./alert-events";
import { DeliveriesSection } from "./DeliveriesSection";

const SMTP_VARS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
];

function AddEmailAlertDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["metadata.changed"]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createEmailAlert({ email, events }),
    onSuccess: () => {
      invalidateEmailAlertMutation(queryClient);
      toast.success("Email alert added");
      setOpen(false);
      setEmail("");
      setEvents(["metadata.changed"]);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not add email alert",
      );
    },
  });

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (events.length === 0) {
      setError("Select at least one event");
      return;
    }

    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add email alert
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add email alert</DialogTitle>
            <DialogDescription>
              asobeast emails this recipient when a subscribed event fires,
              using your configured SMTP server.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email-alert-address">Recipient email</Label>
            <Input
              id="email-alert-address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="alerts@example.com"
              aria-invalid={error !== null}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Events</Label>
            <EventToggles value={events} onChange={setEvents} />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Add email alert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmailAlertRow({ alert }: { alert: EmailAlertItem }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateEmailAlert(alert.id, { active }),
    onSuccess: () => invalidateEmailAlertMutation(queryClient),
    onError: () => toast.error("Could not update email alert"),
  });

  const test = useMutation({
    mutationFn: () => testEmailAlert(alert.id),
    onSuccess: (result) => {
      if (result.delivered) {
        toast.success("Test email sent");
      } else {
        toast.error("Could not send the test email");
      }
    },
    onError: () => toast.error("Could not send the test email"),
  });

  const remove = useMutation({
    mutationFn: () => deleteEmailAlert(alert.id),
    onSuccess: () => {
      invalidateEmailAlertMutation(queryClient);
      setConfirmOpen(false);
      toast.success("Email alert removed");
    },
    onError: () => toast.error("Could not remove email alert"),
  });

  return (
    <TableRow>
      <TableCell className="max-w-[18rem] align-top font-medium">
        <span className="block truncate">{alert.email}</span>
        <div className="mt-2">
          <DeliveriesSection channel="email" id={alert.id} />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {alert.events.map((event) => (
            <Badge key={event} variant="outline">
              {EVENT_LABELS[event]}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={alert.active}
          disabled={toggle.isPending}
          aria-label={`Toggle ${alert.email}`}
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
            aria-label={`Delete ${alert.email}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
          </Button>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this email alert?</AlertDialogTitle>
              <AlertDialogDescription>
                asobeast will stop emailing {alert.email}. This cannot be undone.
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

function SetupHint() {
  return (
    <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Email alerts are disabled.</p>
      <p className="mt-1">
        Set the SMTP environment variables on the API to enable them:
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SMTP_VARS.map((name) => (
          <code
            key={name}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
          >
            {name}
          </code>
        ))}
      </div>
      <p className="mt-3">
        <code className="font-mono text-xs">SMTP_HOST</code> and{" "}
        <code className="font-mono text-xs">SMTP_FROM</code> are required.
      </p>
    </div>
  );
}

export function EmailAlertsCard() {
  const { data: config } = useSuspenseQuery(alertsConfigOptions);
  const { data } = useSuspenseQuery(emailAlertsOptions);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Alerts</CardDescription>
          <CardTitle>Email</CardTitle>
        </div>
        {config.emailEnabled ? <AddEmailAlertDialog /> : null}
      </CardHeader>
      <CardContent>
        {!config.emailEnabled ? (
          <SetupHint />
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No email alerts yet. Add a recipient to receive metadata and rank
            alerts by email.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableCaption className="sr-only">
                Configured email alerts and their subscribed events.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((alert) => (
                  <EmailAlertRow key={alert.id} alert={alert} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
