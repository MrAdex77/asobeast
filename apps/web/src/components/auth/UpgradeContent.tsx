"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "./use-auth";

const PREMIUM_FEATURES = [
  "Daily keyword rank tracking across every storefront",
  "Traffic, difficulty and opportunity scoring",
  "Competitor discovery and metadata audits",
  "AI audit and metadata drafts",
  "Alerts by email and webhook",
  "Personal API tokens and the MCP server",
];

function trialLine(user: {
  entitled: boolean;
  trialEndsAt: string | null;
}): string {
  if (!user.trialEndsAt) return "Upgrade to premium to unlock asobeast.";
  const ended = new Date(user.trialEndsAt);
  const formatted = new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(ended);
  return user.entitled
    ? `Your trial is active until ${formatted}.`
    : `Your trial ended on ${formatted}.`;
}

export function UpgradeContent() {
  const { user } = useAuth();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardDescription>asobeast Premium</CardDescription>
          <CardTitle>Keep optimizing without limits</CardTitle>
          {user ? (
            <p className="text-sm text-muted-foreground">{trialLine(user)}</p>
          ) : null}
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-2">
          <Button disabled title="Checkout arrives with the billing release">
            Upgrade to premium
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Checkout is coming soon. Need help now?{" "}
            <a
              href="mailto:hello@asobeast.dev"
              className="font-medium underline"
            >
              Contact support
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
