import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-mock";
import { completeStudyBlock } from "@/lib/study/completion";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const body = await req.json();
    const { action } = body; // "CONFIRM" | "DISMISS"

    if (!action || (action !== "CONFIRM" && action !== "DISMISS")) {
      return NextResponse.json(
        { error: "Ação inválida. Use 'CONFIRM' ou 'DISMISS'." },
        { status: 400 }
      );
    }

    const block = await prisma.studyBlock.findFirst({
      where: { id, userId }
    });

    if (!block) {
      return NextResponse.json(
        { error: "Bloco de estudo não encontrado." },
        { status: 404 }
      );
    }

    if (action === "CONFIRM") {
      // 1. Completar o bloco (lógica SRS + status)
      await completeStudyBlock(userId, id);
      // 2. Limpar a flag de possivelmente já estudado
      const updatedBlock = await prisma.studyBlock.update({
        where: { id },
        data: {
          possiblyAlreadyStudied: false
        }
      });

      return NextResponse.json({
        message: "Bloco confirmado como concluído!",
        block: updatedBlock
      });
    } else {
      // Action === "DISMISS" -> apenas limpa a flag
      const updatedBlock = await prisma.studyBlock.update({
        where: { id },
        data: {
          possiblyAlreadyStudied: false
        }
      });

      return NextResponse.json({
        message: "Flag removida. O bloco permanece pendente para leitura.",
        block: updatedBlock
      });
    }
  } catch (error: any) {
    console.error("[PATCH /api/blocks/[id]/confirm-studied] error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar confirmação do bloco." },
      { status: 500 }
    );
  }
}
