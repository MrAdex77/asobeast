"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseStoreUrl } from "@asobeast/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, importApp } from "@/lib/api";
import { appKeys, portfolioKey } from "@/lib/queries";

export function ImportAppDialog({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: importApp,
    onSuccess: (app) => {
      void queryClient.invalidateQueries({ queryKey: appKeys.all });
      void queryClient.invalidateQueries({ queryKey: portfolioKey });
      setOpen(false);
      toast.success(`Imported ${app.name ?? "app"}`);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.envelope.statusCode === 501) {
          setNote(err.envelope.message);
        } else {
          setError(err.envelope.message);
        }
        return;
      }
      setError("Could not reach the api to import this app");
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setUrl("");
      setError(null);
      setNote(null);
      mutation.reset();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNote(null);

    try {
      parseStoreUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unrecognized store URL");
      return;
    }

    mutation.mutate(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import an app</DialogTitle>
          <DialogDescription>
            Paste an App Store URL to import the app and start tracking its
            keywords.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-url">App Store URL</Label>
            <Input
              id="import-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://apps.apple.com/us/app/name/id123456789"
              autoFocus
              aria-invalid={error !== null}
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            {note ? (
              <Alert>
                <Info />
                <AlertDescription>{note}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || url.trim() === ""}
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {mutation.isPending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
