import Link from "next/link";
import { HealthBadge } from "./HealthBadge";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight"
        >
          asobeast
        </Link>
        <div className="flex items-center gap-3">
          <HealthBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
