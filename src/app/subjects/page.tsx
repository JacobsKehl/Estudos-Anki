/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-mock";
import { BookMarked } from "lucide-react";
import { SubjectCard } from "@/components/subjects/SubjectCard";
import { CreateSubjectDialog } from "@/components/subjects/CreateSubjectDialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

import { getAllSubjectsMetrics } from "@/lib/services/subject-metrics";

import { FlaggedBlocksPanel } from "@/components/study/FlaggedBlocksPanel";

export default async function SubjectsPage() {
  const userId = await getCurrentUserId();

  let subjects: any[] = [];
  let scheduleMode = "DYNAMIC";
  let userPrefsCreatedAt: string | undefined = undefined;
  let flaggedBlocksData: any[] = [];

  try {
    const rawFlagged = await prisma.studyBlock.findMany({
      where: {
        userId,
        possiblyAlreadyStudied: true,
        theoryStatus: { not: "COMPLETED" }
      },
      include: {
        subject: { select: { id: true, name: true } },
        material: { select: { id: true, originalFileName: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    flaggedBlocksData = rawFlagged.map(b => ({
      id: b.id,
      title: b.title,
      subjectId: b.subjectId,
      subjectName: b.subject?.name || "Desconhecido",
      materialId: b.materialId,
      originalFileName: b.material?.originalFileName || "PDF Desconhecido",
      officialTopicId: b.officialTopicId,
      officialTopicName: b.officialTopicName,
      possiblyAlreadyStudied: b.possiblyAlreadyStudied,
      theoryStatus: b.theoryStatus
    }));

    const userPrefs = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { scheduleGenerationMode: true, createdAt: true }
    });
    scheduleMode = userPrefs?.scheduleGenerationMode || "DYNAMIC";
    userPrefsCreatedAt = userPrefs?.createdAt ? userPrefs.createdAt.toISOString() : undefined;

    const subjectsWithMetrics = await getAllSubjectsMetrics(userId);
    
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

      <FlaggedBlocksPanel initialBlocks={flaggedBlocksData} />

      {subjects.length === 0 ? (
        <EmptyState 
          icon={BookMarked}
          title="Você ainda não criou nenhuma matéria"
          description="Comece adicionando sua primeira disciplina para organizar seus materiais e fatiar seus blocos de estudo."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <SubjectCard 
              key={subject.id} 
              subject={subject} 
              scheduleGenerationMode={scheduleMode} 
              userCreatedAt={userPrefsCreatedAt} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
