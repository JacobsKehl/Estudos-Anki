import { getGlobalMetrics } from "@/lib/services/subject-metrics";
import { getMockUserId } from "@/lib/auth-mock";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StudyStats } from "@/components/stats/StudyStats";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const userId = await getMockUserId();
  const metrics = await getGlobalMetrics(userId);

  let goal = "Estudos";
  try {
    const userPrefs = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { examGoal: true }
    });
    if (userPrefs?.examGoal) {
      goal = userPrefs.examGoal;
    }
  } catch (error) {
    console.error("Error fetching preferences on stats page:", error);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <PageHeader 
        icon={Trophy}
        title="Meu Desempenho"
        description={`Acompanhe sua consistência e evolução rumo a: ${goal}.`}
      />

      <StudyStats data={metrics} />
    </div>
  );
}
