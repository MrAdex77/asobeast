import Link from "next/link";
import { HealthBadge } from "./HealthBadge";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="rounded-sm text-lg font-semibold tracking-tight focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          asobeast
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Settings
          </Link>
          <HealthBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
