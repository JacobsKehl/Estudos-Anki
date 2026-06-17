/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { notFound } from "next/navigation";
import { BlockStudyView } from "@/components/blocks/BlockStudyView";

export const dynamic = "force-dynamic";

export default async function BlockPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; from?: string; scheduleItemId?: string }>;
}) {
  const { id } = await params;
  const { returnTo, from, scheduleItemId } = await searchParams;
  const mockUserId = await getMockUserId();

  const block = await (prisma as any).studyBlock.findUnique({
    where: { id },
    include: {
      subject: true,
      material: true,
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

  // Fetch extracted content for the block's pages
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

  // Calculate flashcard stats
  const pendingCount = block.flashcards.filter((f: any) => f.status === "PENDING_APPROVAL").length;
  const approvedCount = block.flashcards.filter((f: any) => f.status === "APPROVED").length;

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
    />
  );
}
