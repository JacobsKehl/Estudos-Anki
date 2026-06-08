import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeStudyBlock, reopenStudyBlock } from "@/lib/study/completion";
import { getMockUserId } from "@/lib/auth-mock";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, pageStart, pageEnd, estimatedStudyMinutes, status } = body;

    const mockUserId = await getMockUserId();

    // Validar propriedade do bloco (ownership)
    const blockExists = await prisma.studyBlock.findFirst({
      where: { id, userId: mockUserId }
    });

    if (!blockExists) {
      return NextResponse.json(
        { error: "Bloco de estudos não encontrado ou acesso não autorizado." },
        { status: 404 }
      );
    }

    let updatedBlock;
    if (status !== undefined) {
      if (status === "COMPLETED") {
        const result = await completeStudyBlock(mockUserId, id);
        updatedBlock = result.block;
      } else {
        const result = await reopenStudyBlock(mockUserId, id, status);
        updatedBlock = result.block;
      }

      if (title !== undefined || description !== undefined || pageStart !== undefined || pageEnd !== undefined || estimatedStudyMinutes !== undefined) {
        updatedBlock = await prisma.studyBlock.update({
          where: { id },
          data: { title, description, pageStart, pageEnd, estimatedStudyMinutes },
        });
      }
    } else {
      updatedBlock = await prisma.studyBlock.update({
        where: { id },
        data: { title, description, pageStart, pageEnd, estimatedStudyMinutes },
      });
    }

    return NextResponse.json(updatedBlock);
  } catch (error: any) {
    console.error("Erro ao atualizar bloco:", error);
    return NextResponse.json({ error: "Erro ao atualizar bloco" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mockUserId = await getMockUserId();

    // Validar propriedade do bloco (ownership)
    const blockExists = await prisma.studyBlock.findFirst({
      where: { id, userId: mockUserId }
    });

    if (!blockExists) {
      return NextResponse.json(
        { error: "Bloco de estudos não encontrado ou acesso não autorizado." },
        { status: 404 }
      );
    }
    
    await prisma.studyBlock.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Bloco excluído com sucesso" });
  } catch (error: any) {
    console.error("Erro ao excluir bloco:", error);
    return NextResponse.json({ error: "Erro ao excluir bloco" }, { status: 500 });
  }
}
