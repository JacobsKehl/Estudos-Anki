import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, pageStart, pageEnd, estimatedStudyMinutes, status } = body;

    const updatedBlock = await prisma.studyBlock.update({
      where: { id },
      data: {
        title,
        description,
        pageStart,
        pageEnd,
        estimatedStudyMinutes,
        status,
      },
    });

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
    
    await prisma.studyBlock.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Bloco excluído com sucesso" });
  } catch (error: any) {
    console.error("Erro ao excluir bloco:", error);
    return NextResponse.json({ error: "Erro ao excluir bloco" }, { status: 500 });
  }
}
