import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  success:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
