/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { BrainCircuit, CheckCircle2, RotateCw, BookOpen, Clock } from "lucide-react";
import { TodayStudyFocus } from "@/components/today/TodayStudyFocus";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { getAdaptiveStudyRecommendation } from "@/lib/recommendations/adaptive-scheduler";

export default async function TodayPage() {
  const mockUserId = "cm39k012x0001k93jqwerty12";
  const now = new Date();

  // 1. Get Adaptive Recommendation
  const recommendation = await getAdaptiveStudyRecommendation(mockUserId);
  
  let currentItem: any = null;
  let pendingReviewsCount = 0;

  try {
    if (recommendation) {
      // Fetch the full block and its schedule item
      const block = await (prisma as any).studyBlock.findUnique({
        where: { id: recommendation.blockId },
        include: { subject: true, material: true }
      });

      // Find the schedule item for this block
      const scheduleItem = await (prisma as any).studyScheduleItem.findFirst({
        where: { studyBlockId: recommendation.blockId, userId: mockUserId },
        include: { subject: true, studyBlock: { include: { material: true } }, material: true }
      });

      if (scheduleItem) {
        currentItem = scheduleItem;
        currentItem.recommendation = recommendation;
        
        // Fetch extracted text
        const extractedContent = await prisma.extractedContent.findMany({
          where: {
            materialId: currentItem.materialId,
            pageNumber: {
              gte: currentItem.studyBlock.pageStart,
              lte: currentItem.studyBlock.pageEnd
            }
          },
          orderBy: { pageNumber: "asc" }
        });
        currentItem.extractedText = extractedContent.map(c => c.text).join("\n\n");
      }
    }

    // 2. Fallback to normal schedule if no adaptive recommendation found or failed
    if (!currentItem) {
      currentItem = await (prisma as any).studyScheduleItem.findFirst({
        where: {
          userId: mockUserId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          schedule: { status: "ACTIVE" }
        },
        include: {
          subject: true,
          studyBlock: { include: { material: true } },
          material: true
        },
        orderBy: { dayNumber: "asc" }
      });

      if (currentItem) {
        const extractedContent = await prisma.extractedContent.findMany({
          where: {
            materialId: currentItem.materialId,
            pageNumber: {
              gte: currentItem.studyBlock.pageStart,
              lte: currentItem.studyBlock.pageEnd
            }
          },
          orderBy: { pageNumber: "asc" }
        });
        currentItem.extractedText = extractedContent.map(c => c.text).join("\n\n");
      }
    }

    // 3. Get pending reviews count
    pendingReviewsCount = await (prisma as any).flashcard.count({
      where: {
        userId: mockUserId,
        status: "APPROVED",
        nextReviewAt: { lte: now }
      }
    });

  } catch (error) {
    console.error("Failed to fetch today's data:", error);
  }

  if (!currentItem) {
    return (
      <div className="flex flex-col items-center justify-center py-20 md:py-32 px-6 space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-sage-light/20 rounded-3xl md:rounded-[2.5rem] flex items-center justify-center transform -rotate-6">
          <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 text-accent" />
        </div>
        <div className="text-center space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold">Tudo em dia por aqui!</h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-md leading-relaxed">
            Suas revisões e metas do cronograma foram concluídas por hoje. Que tal descansar ou dar uma espiada no que vem amanhã?
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full sm:w-auto">
          <Link href="/schedule" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full rounded-2xl h-12 md:h-14 px-8 border-accent/20 text-accent">Ver Cronograma</Button>
          </Link>
          <Link href="/reviews" className="w-full sm:w-auto">
            <Button size="lg" className="w-full rounded-2xl h-12 md:h-14 px-8 gap-2 shadow-lg shadow-accent/20">
              <RotateCw className="w-5 h-5" />
              Revisar Flashcards
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-700 slide-in-from-bottom-4 pb-20">
      <PageHeader 
        icon={BookOpen}
        title="Estudo de Hoje"
        description="Foque apenas neste bloco para maximizar sua absorção de conhecimento."
      />

      <TodayStudyFocus 
        item={currentItem} 
        pendingReviews={pendingReviewsCount} 
      />
    </div>
  );
}
