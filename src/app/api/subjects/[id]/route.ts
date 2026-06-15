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
    const { name, description, priority, examWeight, studyPriority } = body;

    // 1. Validar ownership de forma segura (retorna 404 se não for o dono ou não existir)
    const existingSubject = await prisma.studySubject.findFirst({
      where: { id, userId }
    });

    if (!existingSubject) {
      return NextResponse.json({ error: "Matéria não encontrada" }, { status: 404 });
    }

    // 2. Validar enum studyPriority se estiver presente no body
    if (studyPriority !== undefined) {
      const validPriorities = ["PRIMARY", "ACTIVE", "SECONDARY", "EXCLUDED"];
      if (!validPriorities.includes(studyPriority)) {
        return NextResponse.json(
          { error: "Prioridade inválida. Escolha uma das opções: Alta, Média, Baixa ou Excluída." },
          { status: 400 }
        );
      }
    }

    // 3. Atualizar de forma segura dentro de uma transação Prisma, garantindo remoção de pendências se marcado como EXCLUDED
    const subject = await prisma.$transaction(async (tx) => {
      const updatedSubject = await tx.studySubject.update({
        where: { 
          id,
          userId // Filtrar estritamente pelo id e userId do usuário logado
        },
        data: { name, description, priority, examWeight, studyPriority }
      });

      if (studyPriority === "EXCLUDED") {
        await tx.studyScheduleItem.deleteMany({
          where: {
            userId,
            subjectId: id,
            status: { in: ["PENDING", "IN_PROGRESS"] }
          }
        });
      }

      return updatedSubject;
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
    const subject = await prisma.studySubject.findFirst({ where: { id, userId } });
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
        error: "Esta matéria já possui materiais, blocos ou histórico de estudo. Para preservar seu progresso, ela não pode ser excluída definitivamente. Você pode arquivá-la ou removê-la do cronograma.",
        impact: {
          materials: materialsCount,
          blocks: blocksCount,
          flashcards: flashcardsCount,
          scheduleItems: scheduleItemsCount,
        },
        suggestion: "archive",
        message: "Esta matéria já possui materiais, blocos ou histórico de estudo. Para preservar seu progresso, ela não pode ser excluída definitivamente. Você pode arquivá-la ou removê-la do cronograma."
      }, { status: 409 });
    }

    // Safe to delete — no dependencies
    await prisma.studySubject.delete({ where: { id } });
    return NextResponse.json({ message: "Matéria excluída com sucesso" });

  } catch (error: any) {
    return NextResponse.json({ error: "Erro ao excluir matéria", details: error.message }, { status: 500 });
  }
}
