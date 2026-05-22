import { Skeleton } from "@/components/ui/skeleton";

export default function SubjectDetailsLoading() {
  return (
    <div className="space-y-8 max-w-6xl animate-pulse pb-20">
      
      {/* Navigation & Header */}
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="w-36 h-8 rounded-xl -ml-3" />
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 bg-card p-6 md:p-8 rounded-3xl border border-border/50 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
          <div className="flex gap-4 items-start w-full">
            <Skeleton className="w-16 h-16 rounded-2xl shrink-0" variant="sage" />
            <div className="space-y-2 flex-1">
              <Skeleton className="w-1/3 h-8 rounded-xl" />
              <Skeleton className="w-2/3 h-4 rounded-lg" />
              <div className="flex items-center gap-4 mt-2">
                <Skeleton className="w-24 h-4 rounded-lg" />
                <Skeleton className="w-24 h-4 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Panel Skeleton */}
      <div className="space-y-6">
        {/* Main Health Card Skeleton */}
        <div className="p-6 md:p-8 rounded-[2.5rem] border border-sage-light/30 bg-sage-light/10 dark:bg-accent/5 flex flex-col md:flex-row items-center gap-6">
          <Skeleton className="w-16 h-16 rounded-3xl shrink-0" variant="sage" />
          <div className="flex-1 space-y-2 text-center md:text-left w-full">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <Skeleton className="w-56 h-7 rounded-lg mx-auto md:mx-0" />
              <Skeleton className="w-28 h-5 rounded-full mx-auto md:mx-0" variant="sage" />
            </div>
            <Skeleton className="w-2/3 h-4 rounded-lg mx-auto md:mx-0" />
          </div>
        </div>

        {/* Metrics Grid Skeletons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card p-5 rounded-3xl border border-border/40 space-y-3 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
              <Skeleton className="w-10 h-10 rounded-xl" variant={i % 2 === 0 ? "sage" : "default"} />
              <div className="space-y-2">
                <Skeleton className="w-12 h-3 rounded" />
                <Skeleton className="w-16 h-6 rounded-md" />
                <Skeleton className="w-20 h-3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid: Blocks and Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Blocks */}
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-6">
            {/* Section Header */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-36 h-6 rounded-md" />
              </div>
              <Skeleton className="w-44 h-8 rounded-lg" variant="sage" />
            </div>

            {/* Block items */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 rounded-[1.5rem] border border-border/40 bg-card/50 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <Skeleton className="w-10 h-10 rounded-xl" variant="sage" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="w-1/4 h-5 rounded-lg" />
                        <Skeleton className="w-1/2 h-4 rounded-lg" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Skeleton className="w-20 h-8 rounded-lg" />
                      <Skeleton className="w-24 h-8 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Materials */}
        <div className="space-y-6">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-border pb-2">
            <Skeleton className="w-24 h-6 rounded-md" />
            <Skeleton className="w-16 h-5 rounded-md" />
          </div>

          {/* Material items */}
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-6 rounded-[2rem] border border-border/30 bg-card/30 space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="w-2/3 h-5 rounded-lg" />
                    <Skeleton className="w-1/3 h-4 rounded-lg" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="w-16 h-5 rounded-full" />
                  <Skeleton className="w-20 h-5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
