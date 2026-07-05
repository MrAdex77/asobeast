import type { ReactNode } from "react";
import { Card } from "./Card";

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-zinc-400">
          {label}
        </span>
        <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {value}
        </span>
        {hint ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
        ) : null}
      </div>
    </Card>
  );
}
