/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-mock";
import { notFound } from "next/navigation";
import { BlockStudyView } from "@/components/blocks/BlockStudyView";

export const dynamic = "force-dynamic";

export default async function BlockPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; from?: string; scheduleItemId?: string; secondPass?: string }>;
}) {
  const { id } = await params;
  const { returnTo, from, scheduleItemId, secondPass } = await searchParams;
  const mockUserId = await getCurrentUserId();

  const block = await (prisma as any).studyBlock.findUnique({
    where: { id },
    include: {
      subject: true,
      material: true,
      gapNote: true,
      supportMaterials: { include: { material: true } },
      _count: {
        select: {
          flashcards: true
        }
      },
      flashcards: {
        where: { userId: mockUserId },
        select: {
          id: true,
          question: true,
          answer: true,
          type: true,
          difficulty: true,
          status: true
        }
      }
    }
  });

  if (!block || block.userId !== mockUserId) {
    notFound();
  }

  const content = await prisma.extractedContent.findMany({
    where: {
      materialId: block.materialId,
      pageNumber: {
        gte: block.pageStart,
        lte: block.pageEnd
      }
    },
    orderBy: {
      pageNumber: "asc"
    }
  });

  const pendingCount = block.flashcards.filter((f: any) => f.status === "PENDING_APPROVAL").length;
  const approvedCount = block.flashcards.filter((f: any) => f.status === "APPROVED").length;

  let sourceV1Info: { sourceTitle: string; totalV2Topics: number } | null = null;
  if (block.possiblyAlreadyStudied && block.sourceV1BlockId) {
    const sourceBlock = await prisma.studyBlock.findUnique({
      where: { id: block.sourceV1BlockId },
      select: { title: true, officialTopicId: true }
    });

    if (sourceBlock) {
      let v2Count = 1;
      if (sourceBlock.officialTopicId) {
        v2Count = await prisma.syllabusTopicMapping.count({
          where: { v1TopicId: sourceBlock.officialTopicId }
        });
      }
      sourceV1Info = {
        sourceTitle: sourceBlock.title,
        totalV2Topics: Math.max(v2Count, 1)
      };
    }
  }

  return (
    <BlockStudyView 
      block={block} 
      content={content}
      stats={{
        total: block._count.flashcards,
        pending: pendingCount,
        approved: approvedCount
      }}
      returnTo={returnTo || null}
      from={from || null}
      scheduleItemId={scheduleItemId || null}
      secondPass={secondPass === "true"}
      sourceV1Info={sourceV1Info}
    />
  );
}
