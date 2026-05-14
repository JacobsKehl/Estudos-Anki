/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { notFound } from "next/navigation";
import { BlockStudyView } from "@/components/blocks/BlockStudyView";

export const dynamic = "force-dynamic";

export default async function BlockPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const mockUserId = await getMockUserId();

  const block = await (prisma as any).studyBlock.findUnique({
    where: { id },
    include: {
      subject: true,
      material: true,
      _count: {
        select: {
          flashcards: true
        }
      },
      flashcards: {
        where: { userId: mockUserId },
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  if (!block) {
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
    />
  );
}
