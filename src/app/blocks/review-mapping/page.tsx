import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-mock";
import { OFFICIAL_TOPICS } from "@/lib/constants/official-topics";
import { ReviewMappingClient } from "./ReviewMappingClient";

export const dynamic = "force-dynamic";

export default async function ReviewMappingPage() {
  const userId = await getCurrentUserId();

  // Buscar todos os blocos do usuário que precisam de revisão manual ou estão sem tópico oficial
  const unmappedBlocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      OR: [
        { needsManualReview: true },
        { officialTopicId: null },
      ],
    },
    include: {
      subject: { select: { id: true, name: true } },
      material: { select: { id: true, fileName: true } },
    },
    orderBy: [{ subjectId: "asc" }, { orderIndex: "asc" }],
  });

  const formattedBlocks = unmappedBlocks.map((b) => ({
    id: b.id,
    title: b.title,
    pageStart: b.pageStart,
    pageEnd: b.pageEnd,
    confidence: b.confidence ?? null,
    officialTopicId: b.officialTopicId,
    officialTopicName: b.officialTopicName,
    subjectName: b.subject?.name || "Geral",
    materialFileName: b.material?.fileName || "Material Desconhecido",
  }));

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Revisão de Mapeamento de Tópicos (H3)</h1>
        <p className="text-muted-foreground mt-1">
          Blocos com baixa confiança de mapeamento (&lt; 0.7) ou que exigem confirmação manual do edital.
        </p>
      </div>

      <ReviewMappingClient
        initialBlocks={formattedBlocks}
        allOfficialTopics={OFFICIAL_TOPICS}
      />
    </div>
  );
}
