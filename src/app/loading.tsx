import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-10 max-w-4xl mx-auto pb-24">
      {/* Page Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-2xl" variant="sage" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-7 rounded-lg" />
            <Skeleton className="w-64 h-4 rounded-lg" />
          </div>
        </div>
        <Skeleton className="w-36 h-10 rounded-xl shrink-0" />
      </div>

      {/* Hero: Next Action Skeleton */}
      <div className="relative overflow-hidden rounded-[2rem] border border-sage-light/30 dark:border-accent/10 p-7 bg-sage-light/10 dark:bg-accent/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-3 flex-1">
            <Skeleton className="w-24 h-5 rounded-full" variant="sage" />
            <Skeleton className="w-2/3 h-8 rounded-xl" />
            <Skeleton className="w-1/2 h-4 rounded-lg" />
          </div>
          <Skeleton className="w-36 h-11 rounded-xl shrink-0" variant="sage" />
        </div>
      </div>

      {/* Daily Goal Alert Skeleton */}
      <Skeleton className="w-full h-16 rounded-[1.5rem]" />

      {/* Section 1: Estudo do Dia */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-sage-light/30">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 bg-accent/40 rounded-full" />
            <Skeleton className="w-32 h-5 rounded-lg" />
          </div>
          <Skeleton className="w-20 h-4 rounded-lg" />
        </div>

        {/* Task Cards */}
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-[1.5rem] border border-border/40 bg-card/50"
            >
              <div className="flex items-center gap-4 flex-1">
                <Skeleton className="w-10 h-10 rounded-xl" variant="sage" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="w-1/3 h-5 rounded-lg" />
                  <Skeleton className="w-1/2 h-4 rounded-lg" />
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Skeleton className="w-20 h-8 rounded-lg" />
                <Skeleton className="w-28 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Cards do Dia */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-sage-light/30">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 bg-accent/40 rounded-full" />
            <Skeleton className="w-32 h-5 rounded-lg" />
          </div>
          <Skeleton className="w-40 h-4 rounded-lg" />
        </div>

        {/* Flashcards Big Card */}
        <div className="border border-sage-light/40 dark:border-accent/10 rounded-[2rem] p-8 bg-card/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-5 flex-1">
              <div className="space-y-2">
                <Skeleton className="w-16 h-10 rounded-xl" variant="sage" />
                <Skeleton className="w-36 h-4 rounded-lg" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="w-32 h-6 rounded-md" />
                <Skeleton className="w-28 h-6 rounded-md" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="w-16 h-5 rounded-full" />
                <Skeleton className="w-20 h-5 rounded-full" />
                <Skeleton className="w-20 h-5 rounded-full" />
              </div>
            </div>
            <Skeleton className="w-48 h-12 rounded-2xl shrink-0" variant="sage" />
          </div>
        </div>
      </div>
    </div>
  );
}
