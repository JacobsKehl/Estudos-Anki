import { Skeleton } from "@/components/ui/skeleton";

export default function MaterialsLoading() {
  return (
    <div className="space-y-10 max-w-6xl pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-2xl" variant="sage" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-7 rounded-lg" />
            <Skeleton className="w-64 h-4 rounded-lg" />
          </div>
        </div>
        <Skeleton className="w-36 h-10 rounded-xl shrink-0" />
      </div>

      {/* Cloud-First Welcome Hero */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Main Action Card */}
        <div className="lg:col-span-8 rounded-[2.5rem] p-8 md:p-10 border border-border/50 dark:border-accent/10 relative overflow-hidden flex flex-col justify-between shadow-sm bg-card/40 min-h-[300px]">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="w-32 h-6 rounded-full" variant="sage" />
              <Skeleton className="w-28 h-6 rounded-full" />
            </div>
            <Skeleton className="w-2/3 h-10 rounded-xl" />
            <Skeleton className="w-3/4 h-5 rounded-lg" />
            <Skeleton className="w-1/2 h-5 rounded-lg" />
          </div>
          <div className="mt-8">
            <Skeleton className="w-48 h-12 rounded-xl" variant="sage" />
          </div>
        </div>

        {/* Upload & Info Cards Container */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Upload Card */}
          <div className="rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center space-y-6 border border-accent/20 dark:border-accent/10 bg-sage-light/10 dark:bg-accent/5 min-h-[220px]">
            <Skeleton className="w-14 h-14 rounded-3xl" variant="sage" />
            <div className="space-y-2">
              <Skeleton className="w-32 h-5 rounded-lg" />
              <Skeleton className="w-48 h-3.5 rounded-lg" />
            </div>
            <Skeleton className="w-28 h-10 rounded-xl" variant="sage" />
          </div>

          {/* Stats/Status Card */}
          <div className="bg-muted/20 rounded-[2.5rem] p-6 border border-border/40 flex flex-col justify-center space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-2xl" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="w-20 h-3 rounded" />
                <Skeleton className="w-28 h-5 rounded-md" />
              </div>
            </div>
            <Skeleton className="w-full h-4 rounded-md" />
          </div>
        </div>
      </div>

      {/* Library View */}
      <div className="space-y-6 pt-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/40">
          <Skeleton className="w-40 h-7 rounded-lg" />
        </div>

        {/* Material item skeletons */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-[2rem] border border-border/30 bg-card/30"
            >
              <div className="flex items-center gap-4 flex-1">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="w-1/3 h-5 rounded-lg" />
                  <div className="flex gap-2">
                    <Skeleton className="w-20 h-4 rounded-full" />
                    <Skeleton className="w-16 h-4 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Skeleton className="w-24 h-9 rounded-lg" />
                <Skeleton className="w-28 h-9 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
