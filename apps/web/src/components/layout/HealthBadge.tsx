"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { healthOptions } from "@/lib/queries";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function HealthBadge() {
  const { data, error, isPending } = useQuery(healthOptions);

  const state = isPending
    ? {
        dot: "bg-muted-foreground animate-pulse",
        label: "api",
        detail: "Checking API status…",
      }
    : data?.status === "ok"
      ? {
          dot: "bg-emerald-500",
          label: "api",
          detail: "API healthy · database up",
        }
      : error instanceof ApiError
        ? {
            dot: "bg-amber-500",
            label: "degraded",
            detail: "API up · database unavailable",
          }
        : {
            dot: "bg-red-500",
            label: "unreachable",
            detail: "API unreachable",
          };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", state.dot)} />
            <span>{state.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{state.detail}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
