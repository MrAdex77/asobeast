import { AppHeaderSkeleton } from "@/components/app-detail/skeletons";
import { StatCardsSkeleton } from "@/components/overview/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <AppHeaderSkeleton />

      <div className="flex gap-4 border-b pb-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-20" />
        ))}
      </div>

      <StatCardsSkeleton />
    </div>
  );
}
