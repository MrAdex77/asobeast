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
import { ComparisonMatrix } from "./ComparisonMatrix";
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

      {competitors.length > 0 ? (
        <CompetitorList id={id} competitors={competitors} />
      ) : null}

      <ComparisonMatrix id={id} />
    </div>
  );
}
