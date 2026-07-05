import Link from "next/link";
import type { AppListItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ImportAppForm } from "@/components/ImportAppForm";
import { getApps } from "@/lib/api";

export default async function HomePage() {
  let apps: AppListItem[] | null = null;
  try {
    apps = await getApps();
  } catch {
    apps = null;
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Apps</h1>
        <ImportAppForm />
      </section>

      {apps === null ? (
        <EmptyState
          title="Cannot reach the api"
          description="Start the api on port 4000 and refresh to see your tracked apps."
        />
      ) : apps.length === 0 ? (
        <EmptyState
          title="No apps yet"
          description="Paste an App Store URL above to import an app and start tracking its keywords."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {apps.map((app) => (
            <li key={app.id}>
              <Link
                href={`/apps/${app.id}`}
                className="block transition hover:opacity-80"
              >
                <Card>
                  <div className="flex items-center gap-4">
                    <AppIcon src={app.iconUrl} name={app.name} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-medium">
                        {app.name ?? "Untitled app"}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {app.ratingAvg !== null ? (
                          <span>★ {app.ratingAvg.toFixed(1)}</span>
                        ) : null}
                        <span>{app.trackedKeywordCount} keywords</span>
                        <span>{app.competitorCount} competitors</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
