"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  error,
  retry,
  title = "Something went wrong",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  title?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center"
    >
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error.message || "The request could not be completed."}
        </p>
      </div>
      <Button variant="outline" onClick={retry}>
        <RotateCw />
        Try again
      </Button>
    </div>
  );
}
