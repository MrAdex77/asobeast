"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { competitorsOptions } from "@/lib/queries";
import { AddCompetitorForm } from "./AddCompetitorForm";
import { CompetitorList } from "./CompetitorList";

export function CompetitorsView({ id }: { id: string }) {
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardDescription>Competitors</CardDescription>
          <CardTitle>Track the apps you rank against</CardTitle>
        </CardHeader>
        <CardContent>
          <AddCompetitorForm id={id} />
        </CardContent>
      </Card>

      {competitors.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Add a competitor to discover keyword gaps — phrases they rank for and
          you do not. One search serves every app, so tracking competitors costs
          no extra scraping.
        </div>
      ) : (
        <CompetitorList id={id} competitors={competitors} />
      )}
    </div>
  );
}
