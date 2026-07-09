import type { ReactNode } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-detail/AppHeader";
import { SectionNav } from "@/components/app-detail/SectionNav";
import { ApiError } from "@/lib/api";
import { getQueryClient } from "@/lib/get-query-client";
import { appDetailOptions, appSummaryOptions } from "@/lib/queries";

export default async function AppDetailLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();

  try {
    await queryClient.fetchQuery(appDetailOptions(id));
  } catch (error) {
    if (error instanceof ApiError && error.envelope.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  void queryClient.prefetchQuery(appSummaryOptions(id));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        <AppHeader id={id} />
        <SectionNav id={id} />
        {children}
      </div>
    </HydrationBoundary>
  );
}
