"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { portfolioOptions } from "@/lib/queries";
import { ImportAppDialog } from "./ImportAppDialog";
import { PortfolioGrid } from "./PortfolioGrid";
import { PortfolioTotals } from "./PortfolioTotals";

export function AppsDashboard() {
  const { data } = useSuspenseQuery(portfolioOptions);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Apps</h1>
        <ImportAppDialog>
          <Button>Import app</Button>
        </ImportAppDialog>
      </div>

      {data.apps.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
          <div className="flex flex-col gap-1">
            <p className="font-medium">No apps yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Import an app from an App Store or Google Play URL to start
              tracking its keywords.
            </p>
          </div>
          <ImportAppDialog>
            <Button>Import your first app</Button>
          </ImportAppDialog>
        </div>
      ) : (
        <>
          <PortfolioTotals totals={data.totals} />
          <PortfolioGrid apps={data.apps} groups={data.groups} />
        </>
      )}
    </div>
  );
}
