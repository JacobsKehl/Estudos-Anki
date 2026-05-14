/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { BookMarked } from "lucide-react";
import { SubjectCard } from "@/components/subjects/SubjectCard";
import { CreateSubjectDialog } from "@/components/subjects/CreateSubjectDialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

import { getAllSubjectsMetrics } from "@/lib/services/subject-metrics";

export default async function SubjectsPage() {
  const userId = await getMockUserId();

  let subjects: any[] = [];

  try {
    const subjectsWithMetrics = await getAllSubjectsMetrics(userId);
    
    // We also need the _count for the SubjectCard interface if it's not in metrics
    // Fetch them separately or update the service. Let's fetch them here for simplicity or update the service.
    // Actually, SubjectCard uses _count for materials. Let's update the service to include it.
    subjects = await prisma.studySubject.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            materials: true,
            studyBlocks: true,
          }
        }
      },
      orderBy: { priority: "desc" }
    });

    // Merge metrics
    subjects = subjects.map(s => {
      const metric = subjectsWithMetrics.find(m => m.id === s.id);
      return { ...s, metrics: metric?.metrics };
    });
  } catch (error) {
    console.error("DB Error:", error);
  }

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700 slide-in-from-bottom-4">
      <PageHeader 
        icon={BookMarked}
        title="Minhas Matérias"
        description="Organize seu semestre, gerencie PDFs associados e acompanhe seu progresso por disciplina."
      >
        <CreateSubjectDialog />
      </PageHeader>

      {subjects.length === 0 ? (
        <EmptyState 
          icon={BookMarked}
          title="Você ainda não criou nenhuma matéria"
          description="Comece adicionando sua primeira disciplina para organizar seus materiais e fatiar seus blocos de estudo."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </div>
      )}
    </div>
  );
}
