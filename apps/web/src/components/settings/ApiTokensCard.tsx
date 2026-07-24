"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ApiTokenCreated } from "@asobeast/shared";
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, createApiToken, deleteApiToken } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { apiTokensOptions, invalidateApiTokenMutation } from "@/lib/queries";
import { useAuth } from "@/components/auth/use-auth";

function CreateTokenDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<ApiTokenCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createApiToken(name.trim()),
    onSuccess: (result) => {
      invalidateApiTokenMutation(queryClient);
      setCreated(result);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not create the token.",
      );
    },
  });

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setCreated(null);
      setCopied(false);
      setError(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (name.trim() === "") {
      setError("Give the token a name.");
      return;
    }
    mutation.mutate();
  }

  async function copy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.token);
    setCopied(true);
    toast.success("Token copied");
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          New token
        </Button>
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Copy your token</DialogTitle>
              <DialogDescription>
                This is the only time the token is shown. Store it somewhere
                safe — you will not see it again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={created.token}
                aria-label="New api token"
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Copy token"
                onClick={() => void copy()}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => reset(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New API token</DialogTitle>
              <DialogDescription>
                Use a token to authenticate scripts and the MCP server with a
                Bearer header.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="token-name">Name</Label>
              <Input
                id="token-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Local script"
                aria-invalid={error !== null}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                Create token
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RevokeTokenButton({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const revoke = useMutation({
    mutationFn: () => deleteApiToken(id),
    onSuccess: () => {
      invalidateApiTokenMutation(queryClient);
      setOpen(false);
      toast.success("Token revoked");
    },
    onError: () => toast.error("Could not revoke the token"),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Revoke ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
          <AlertDialogDescription>
            Anything using {name} will stop authenticating immediately. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={revoke.isPending}
            onClick={(event) => {
              event.preventDefault();
              revoke.mutate();
            }}
          >
            {revoke.isPending ? "Revoking…" : "Revoke"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ApiTokensCard() {
  const { status, isLoading } = useAuth();
  const authenticated = Boolean(status?.enabled && status.authenticated);
  const { data } = useQuery({ ...apiTokensOptions, enabled: authenticated });

  if (isLoading || !status?.enabled) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Automation</CardDescription>
          <CardTitle>API tokens</CardTitle>
        </div>
        <CreateTokenDialog />
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No tokens yet. Create one to authenticate scripts or the MCP server
            with a Bearer header.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableCaption className="sr-only">
                Personal API tokens for automation.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">{token.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {token.prefix}…
                    </TableCell>
                    <TableCell>{formatDate(token.lastUsedAt)}</TableCell>
                    <TableCell>{formatDate(token.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <RevokeTokenButton id={token.id} name={token.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
