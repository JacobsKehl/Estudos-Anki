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
  searchParams: Promise<{ returnTo?: string; from?: string; scheduleItemId?: string; secondPass?: string }>;
}) {
  const { id } = await params;
  const { returnTo, from, scheduleItemId, secondPass } = await searchParams;
  const mockUserId = await getMockUserId();

  const block = await (prisma as any).studyBlock.findUnique({
    where: { id },
    include: {
      subject: true,
      material: true,
      supportMaterials: { include: { material: true } },
      sources: {
        include: {
          material: true,
          segments: true
        }
      },
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

  const isFeatureEnabled = process.env.ENABLE_HYBRID_8020 === "true";

  let content: any[] = [];
  let hybridContent: any[] = [];

  if (block.methodology === "HYBRID_8020") {
    if (isFeatureEnabled) {
      // 1. Construir condições OR estritas baseadas em segmentos cadastrados
      const segmentConditions = block.sources.flatMap((source: any) =>
        source.segments.map((segment: any) => ({
          materialId: source.materialId,
          pageNumber: {
            gte: segment.pageStart,
            lte: segment.pageEnd,
          },
        }))
      );

      // 2. Buscar exclusivamente as páginas dentro de segmentos mapeados (sem envelopes ou buscas globais do material)
      const dbContents = segmentConditions.length
        ? await prisma.extractedContent.findMany({
            where: { OR: segmentConditions },
            orderBy: [
              { materialId: "asc" },
              { pageNumber: "asc" }
            ]
          })
        : [];

      // 3. Mapear e sinalizar contradições de disposição de páginas
      hybridContent = dbContents.map((ec: any) => {
        const source = block.sources.find((s: any) => s.materialId === ec.materialId);
        const segments = source?.segments?.filter(
          (seg: any) => ec.pageNumber >= seg.pageStart && ec.pageNumber <= seg.pageEnd
        ) || [];

        if (segments.length === 0) {
          return {
            ...ec,
            disposition: null,
            sourceRole: source?.sourceRole || null,
            sourceFileName: source?.material?.fileName || "",
            reason: ""
          };
        }

        const uniqueDispositions = Array.from(new Set(segments.map((s: any) => s.disposition)));
        const isContradictory = uniqueDispositions.length > 1;

        return {
          ...ec,
          disposition: isContradictory ? "CONTRADICTION" : segments[0].disposition,
          sourceRole: source?.sourceRole || null,
          sourceFileName: source?.material?.fileName || "",
          reason: isContradictory
            ? `Conflito de disposições: ${uniqueDispositions.join(", ")}`
            : segments[0].reason || "",
          isContradictory
        };
      }).filter((c: any) => c.disposition !== null);
    }
  } else {
    // Fetch extraído tradicional
    content = await prisma.extractedContent.findMany({
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
  }

  const pendingCount = block.flashcards.filter((f: any) => f.status === "PENDING_APPROVAL").length;
  const approvedCount = block.flashcards.filter((f: any) => f.status === "APPROVED").length;

  return (
    <BlockStudyView 
      block={block} 
      content={content}
      hybridContent={hybridContent}
      isHybridEnabled={isFeatureEnabled}
      stats={{
        total: block._count.flashcards,
        pending: pendingCount,
        approved: approvedCount
      }}
      returnTo={returnTo || null}
      from={from || null}
      scheduleItemId={scheduleItemId || null}
      secondPass={secondPass === "true"}
    />
  );
}
