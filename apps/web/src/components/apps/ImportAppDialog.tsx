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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, importApp } from "@/lib/api";
import { COUNTRY_CODE, COUNTRY_OPTIONS, OTHER } from "@/lib/countries";
import { formatCountry } from "@/lib/format";
import { appKeys, portfolioKey } from "@/lib/queries";

export function ImportAppDialog({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState("us");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ url, country }: { url: string; country: string }) =>
      importApp(url, country),
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

  function reset() {
    setUrl("");
    setSelected("us");
    setCustom("");
    setError(null);
    setNote(null);
    mutation.reset();
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
    }
  }

  function onUrlChange(value: string) {
    setUrl(value);
    try {
      const { country } = parseStoreUrl(value);
      if (COUNTRY_OPTIONS.includes(country)) {
        setSelected(country);
        setCustom("");
      } else {
        setSelected(OTHER);
        setCustom(country);
      }
    } catch {
      return;
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

    const country = (selected === OTHER ? custom : selected)
      .trim()
      .toLowerCase();
    if (!COUNTRY_CODE.test(country)) {
      setError("Country must be a two letter code, e.g. us");
      return;
    }

    mutation.mutate({ url, country });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import an app</DialogTitle>
          <DialogDescription>
            Paste an App Store or Google Play URL to import the app and start
            tracking its keywords.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-url">Store URL</Label>
            <Input
              id="import-url"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="apps.apple.com/us/app/name/id123 or play.google.com/store/apps/details?id=com.name"
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="import-country">Home storefront</Label>
            <p className="text-xs text-muted-foreground">
              Where this app&apos;s metadata and category ranks are read. Add
              other markets later from the keyword monitor.
            </p>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="import-country" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code.toUpperCase()} · {formatCountry(code)}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>Other…</SelectItem>
              </SelectContent>
            </Select>
            {selected === OTHER ? (
              <Input
                aria-label="Storefront country code"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                placeholder="two letter code, e.g. se"
                maxLength={2}
                className="w-[200px]"
              />
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
