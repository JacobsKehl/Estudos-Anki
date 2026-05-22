import { Skeleton } from "@/components/ui/skeleton";

export default function ScheduleLoading() {
  return (
    <div className="space-y-8 max-w-6xl pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-2xl" variant="sage" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-7 rounded-lg" />
            <Skeleton className="w-64 h-4 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-40 h-10 rounded-xl" />
          <Skeleton className="w-28 h-10 rounded-xl" />
        </div>
      </div>

      {/* Timeline active items */}
      <div className="space-y-10 relative before:absolute before:left-[19px] before:top-2 before:h-[calc(100%-16px)] before:w-[2px] before:bg-border/30">
        {[1, 2].map((dayIdx) => (
          <div key={dayIdx} className="relative pl-12 space-y-4">
            {/* Timeline node skeleton */}
            <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-border/50 bg-background z-10">
              <Skeleton className="w-4 h-4 rounded-full" />
            </div>

            {/* Day Header */}
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <Skeleton className="w-24 h-6 rounded-md" />
                <Skeleton className="w-12 h-4 rounded-md" />
              </div>
              <div className="h-px flex-1 bg-border/20" />
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((itemIdx) => (
                <div
                  key={itemIdx}
                  className="bg-card p-5 rounded-2xl border border-border/30 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="w-24 h-4 rounded-md" variant="sage" />
                      <Skeleton className="w-3/4 h-5 rounded-lg" />
                    </div>
                    <Skeleton className="w-16 h-4 rounded" />
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <Skeleton className="w-20 h-4 rounded-md" />
                    <Skeleton className="w-16 h-4 rounded-md" />
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t border-border/20">
                    <div className="flex justify-between items-center">
                      <Skeleton className="w-24 h-3.5 rounded" />
                      <Skeleton className="w-12 h-3.5 rounded" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="w-16 h-4.5 rounded-full" />
                      <Skeleton className="w-20 h-4.5 rounded-full" />
                    </div>
                  </div>

                  <div className="pt-2">
                    <Skeleton className="w-full h-9 rounded-xl" variant="sage" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
