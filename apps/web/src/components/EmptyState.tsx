import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
      <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
        {title}
      </h2>
      {description ? (
        <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}
