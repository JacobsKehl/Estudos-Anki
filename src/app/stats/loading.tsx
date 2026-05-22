import { Skeleton } from "@/components/ui/skeleton";

export default function StatsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-2xl" variant="sage" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-7 rounded-lg" />
            <Skeleton className="w-64 h-4 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Summary Grid Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card p-6 rounded-3xl border border-border/30 flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl" variant={i % 2 === 0 ? "sage" : "beige"} />
            <div className="space-y-2 flex-1">
              <Skeleton className="w-20 h-3 rounded" />
              <Skeleton className="w-16 h-6 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Heatmap Card */}
        <div className="rounded-[2.5rem] border border-border/30 bg-card p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-5 h-5 rounded" variant="sage" />
            <Skeleton className="w-48 h-6 rounded-lg" />
          </div>
          <div className="flex items-end gap-1.5 h-32 w-full pt-8">
            {Array.from({ length: 20 }).map((_, idx) => (
              <Skeleton
                key={idx}
                className="flex-1 rounded-t-md"
                style={{ height: `${10 + (idx * 7) % 75}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs pt-2">
            <Skeleton className="w-16 h-4 rounded" />
            <Skeleton className="w-12 h-4 rounded" />
          </div>
        </div>

        {/* Mastery Card */}
        <div className="rounded-[2.5rem] border border-border/30 bg-card p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-5 h-5 rounded" variant="beige" />
            <Skeleton className="w-56 h-6 rounded-lg" />
          </div>
          {/* Progress bar stack skeleton */}
          <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/40 rounded-full flex overflow-hidden">
            <Skeleton className="w-2/5 h-full" variant="sage" />
            <Skeleton className="w-1/5 h-full" variant="beige" />
            <Skeleton className="w-1/5 h-full bg-peach/20" />
            <Skeleton className="w-1/5 h-full bg-slate-300/40" />
          </div>
          {/* Legend Grid */}
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-3 h-3 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="w-24 h-3 rounded" />
                  <Skeleton className="w-16 h-4 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subject Progress Card */}
      <div className="rounded-[2.5rem] border border-border/30 bg-card p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-5 h-5 rounded" variant="sage" />
          <Skeleton className="w-48 h-6 rounded-lg" />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <Skeleton className="w-36 h-4 rounded" />
                  <Skeleton className="w-48 h-3 rounded" />
                </div>
                <Skeleton className="w-10 h-4 rounded" />
              </div>
              <Skeleton className="w-full h-2 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
