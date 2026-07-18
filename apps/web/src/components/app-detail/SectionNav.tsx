"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const SECTIONS = [
  { segment: "", label: "Overview" },
  { segment: "keywords", label: "Keywords" },
  { segment: "rankings", label: "Rankings" },
  { segment: "competitors", label: "Competitors" },
  { segment: "changes", label: "Changes" },
  { segment: "reviews", label: "Reviews" },
  { segment: "audit", label: "Audit" },
  { segment: "metadata", label: "Metadata" },
] as const;

export function SectionNav({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/apps/${id}`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {SECTIONS.map((section) => {
        const href = section.segment ? `${base}/${section.segment}` : base;
        const active = section.segment
          ? pathname.startsWith(href)
          : pathname === base;
        return (
          <Link
            key={section.segment || "overview"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
