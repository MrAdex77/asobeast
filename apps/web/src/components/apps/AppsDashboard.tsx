"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { appsListOptions } from "@/lib/queries";
import { AppCard } from "./AppCard";
import { ImportAppDialog } from "./ImportAppDialog";

export function AppsDashboard() {
  const { data: apps } = useSuspenseQuery(appsListOptions);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Apps</h1>
        <ImportAppDialog>
          <Button>Import app</Button>
        </ImportAppDialog>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
          <div className="flex flex-col gap-1">
            <p className="font-medium">No apps yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Import an app from an App Store URL to start tracking its keywords.
            </p>
          </div>
          <ImportAppDialog>
            <Button>Import your first app</Button>
          </ImportAppDialog>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <li key={app.id}>
              <AppCard app={app} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
