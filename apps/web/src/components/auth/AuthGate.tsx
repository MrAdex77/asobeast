"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "./use-auth";

const PUBLIC_ROUTES = ["/login", "/register", "/upgrade"];

function daysLeft(iso: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, trialOnly, isFetching } = useAuth();
  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const blocked = Boolean(
    status?.enabled && !status.authenticated && !isPublic,
  );

  useEffect(() => {
    if (blocked && !isFetching) {
      router.replace("/login");
    }
  }, [blocked, isFetching, router]);

  if (blocked) {
    return (
      <main
        role="status"
        aria-label="Checking your session"
        className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 py-8"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const trialEndsAt = user?.trialEndsAt;
  const remaining =
    !isPublic && trialOnly && trialEndsAt ? daysLeft(trialEndsAt) : null;

  return (
    <>
      {remaining !== null ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-2 text-sm">
            <span>
              Trial ends in {remaining} day{remaining === 1 ? "" : "s"}.
            </span>
            <Link href="/upgrade" className="font-medium underline">
              Upgrade
            </Link>
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
