import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-mock";
import { OFFICIAL_TOPICS } from "@/lib/constants/official-topics";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const body = await req.json();
    const { officialTopicId } = body;

    if (!officialTopicId || typeof officialTopicId !== "string") {
      return NextResponse.json(
        { error: "Campo 'officialTopicId' é obrigatório." },
        { status: 400 }
      );
    }

    // 1. Validar que o bloco pertence ao usuário autenticado (Isolamento Multi-tenant)
    const existingBlock = await prisma.studyBlock.findFirst({
      where: { id, userId },
    });

    if (!existingBlock) {
      return NextResponse.json(
        { error: "Bloco de estudo não encontrado." },
        { status: 404 }
      );
    }

    // 2. Localizar o tópico na matriz oficial de tópicos
    const selectedTopic = OFFICIAL_TOPICS.find((t) => t.id === officialTopicId);

    if (!selectedTopic) {
      return NextResponse.json(
        { error: `Tópico oficial inválido: '${officialTopicId}'` },
        { status: 400 }
      );
    }

    // 3. Atualizar o bloco com o tópico selecionado e remover a flag de revisão manual
    const updatedBlock = await prisma.studyBlock.update({
      where: { id },
      data: {
        officialTopicId: selectedTopic.id,
        officialTopicName: selectedTopic.title,
        topicCode: selectedTopic.topicCode,
        confidence: 1.0,
        needsManualReview: false,
      },
    });

    return NextResponse.json({
      message: "Tópico atribuído com sucesso.",
      block: updatedBlock,
    });
  } catch (error: any) {
    console.error("[PATCH /api/blocks/[id]/assign-topic] error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao atribuir tópico ao bloco." },
      { status: 500 }
    );
  }
}
