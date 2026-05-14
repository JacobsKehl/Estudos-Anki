/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getMockUserId();
    const body = await req.json();
    const { name, description, priority, examWeight } = body;

    const subject = await prisma.studySubject.update({
      where: { id, userId },
      data: { name, description, priority, examWeight }
    });

    return NextResponse.json(subject);
  } catch (error: any) {
    return NextResponse.json({ error: "Erro ao atualizar matéria", details: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getMockUserId();

    // Verify subject belongs to user
    const subject = await prisma.studySubject.findUnique({ where: { id, userId } });
    if (!subject) {
      return NextResponse.json({ error: "Matéria não encontrada" }, { status: 404 });
    }

    // Check for dependencies before allowing deletion
    const [materialsCount, blocksCount, flashcardsCount, scheduleItemsCount] = await Promise.all([
      prisma.studyMaterial.count({ where: { subjectId: id } }),
      (prisma as any).studyBlock.count({ where: { subjectId: id } }),
      (prisma as any).flashcard.count({ where: { subjectId: id } }),
      (prisma as any).studyScheduleItem.count({ where: { subjectId: id } }),
    ]);

    const hasData = materialsCount > 0 || blocksCount > 0 || flashcardsCount > 0 || scheduleItemsCount > 0;

    if (hasData) {
      return NextResponse.json({
        error: "Esta matéria tem dados vinculados que impedem a exclusão direta.",
        impact: {
          materials: materialsCount,
          blocks: blocksCount,
          flashcards: flashcardsCount,
          scheduleItems: scheduleItemsCount,
        },
        suggestion: "archive",
        message: `Encontramos ${materialsCount} material(is), ${blocksCount} bloco(s), ${flashcardsCount} flashcard(s) e ${scheduleItemsCount} item(ns) no cronograma. Use 'Arquivar' para ocultar sem perder o histórico.`
      }, { status: 409 });
    }

    // Safe to delete — no dependencies
    await prisma.studySubject.delete({ where: { id, userId } });
    return NextResponse.json({ message: "Matéria excluída com sucesso" });

  } catch (error: any) {
    return NextResponse.json({ error: "Erro ao excluir matéria", details: error.message }, { status: 500 });
  }
}
