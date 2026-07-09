import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AppActions } from "@/components/AppActions";
import { AppIcon } from "@/components/AppIcon";
import { AppTabs } from "@/components/AppTabs";
import { Badge } from "@/components/Badge";
import { getApp } from "@/lib/api";

export default async function AppDetailLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const { id } = await params;
  const detail = await getApp(id).catch(() => null);
  if (!detail) notFound();

  const storeLabel = detail.store === "APP_STORE" ? "App Store" : "Google Play";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <AppIcon src={detail.iconUrl} name={detail.name} size={64} />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {detail.name ?? "Untitled app"}
            </h1>
            <Badge tone="info">{storeLabel}</Badge>
          </div>
        </div>
        <AppActions appId={detail.id} />
      </header>
      <AppTabs appId={detail.id} />
      {children}
    </div>
  );
}
