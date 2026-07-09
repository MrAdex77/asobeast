"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "audit", label: "Audit" },
  { segment: "metadata", label: "Metadata" },
  { segment: "competitors", label: "Competitors" },
];

export function AppTabs({ appId }: { appId: string }) {
  const pathname = usePathname();
  const base = `/apps/${appId}`;

  return (
    <nav className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = tab.segment
          ? pathname.startsWith(href)
          : pathname === base;
        return (
          <Link
            key={tab.segment || "overview"}
            href={href}
            className={
              active
                ? "-mb-px border-b-2 border-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
