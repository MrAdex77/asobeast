import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BudgetCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </CardContent>
    </Card>
  );
}

export function WebhooksCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-8 w-32" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
