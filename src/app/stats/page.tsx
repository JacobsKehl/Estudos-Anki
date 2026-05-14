import { getGlobalMetrics } from "@/lib/services/subject-metrics";
import { getMockUserId } from "@/lib/auth-mock";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StudyStats } from "@/components/stats/StudyStats";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const userId = await getMockUserId();
  const metrics = await getGlobalMetrics(userId);

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <PageHeader 
        icon={Trophy}
        title="Meu Desempenho"
        description="Acompanhe sua consistência e evolução rumo à aprovação no TRT4."
      />

      <StudyStats data={metrics} />
    </div>
  );
}
