"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./use-auth";

const PUBLIC_ROUTES = ["/login", "/register", "/upgrade"];

function daysLeft(iso: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
}

export function AuthGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, trialOnly, isFetching } = useAuth();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (status?.enabled && !status.authenticated && !isPublic && !isFetching) {
      router.replace("/login");
    }
  }, [status, isPublic, isFetching, router]);

  if (isPublic || !trialOnly || !user?.trialEndsAt) return null;

  const remaining = daysLeft(user.trialEndsAt);
  return (
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
  );
}
