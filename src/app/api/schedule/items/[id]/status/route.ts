/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeStudyBlock, reopenStudyBlock } from "@/lib/study/completion";
import { getMockUserId } from "@/lib/auth-mock";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const userId = await getMockUserId();
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "Status é obrigatório" }, { status: 400 });
    }

    // Buscar o item validando ID e propriedade do usuário (ownership)
    const item = await (prisma as any).studyScheduleItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item não encontrado ou acesso não autorizado." },
        { status: 404 }
      );
    }

    let updatedItem;

    if (item.studyBlockId && item.actionType === "THEORY") {
      if (status === "COMPLETED") {
        await completeStudyBlock(item.userId, item.studyBlockId, item.id);
      } else {
        await reopenStudyBlock(item.userId, item.studyBlockId, status);
      }
      
      updatedItem = await (prisma as any).studyScheduleItem.findFirst({
        where: { id, userId },
        include: { studyBlock: true }
      });
    } else {
      // 1. Atualizar o item do cronograma que já foi validado pelo ownership
      updatedItem = await (prisma as any).studyScheduleItem.update({
        where: { id },
        data: { 
          status,
          ...(status === "COMPLETED" ? { completedAt: new Date(), actualDurationMinutes: null } : { completedAt: null, startedAt: null, actualDurationMinutes: null })
        },
        include: {
          studyBlock: true
        }
      });

      // 2. Criar log complementar se for concluído manualmente
      if (status === "COMPLETED") {
        let logActionType = "REVIEW_BLOCK";
        if (updatedItem.actionType === "REVIEW_FLASHCARDS") {
          logActionType = "REVIEW_FLASHCARDS";
        } else if (updatedItem.actionType === "THEORY") {
          logActionType = "THEORY";
        }

        await (prisma as any).studySessionLog.create({
          data: {
            userId: updatedItem.userId,
            studyBlockId: updatedItem.studyBlockId || null,
            studyScheduleItemId: updatedItem.id,
            actionType: logActionType,
            durationMinutes: updatedItem.estimatedMinutes || 30,
            source: "MANUAL",
            studiedAt: new Date(),
            completedAt: new Date()
          }
        });
      }

      // 3. Sincronizar o status com o StudyBlock original (apenas para itens teóricos completados)
      if (updatedItem.studyBlockId) {
        if (status === "COMPLETED") {
          await (prisma as any).studyBlock.update({
            where: { id: updatedItem.studyBlockId },
            data: { status }
          });
        }
      }
    }

    return NextResponse.json(updatedItem);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[SCHEDULE ITEM STATUS PATCH]", err);
    if (err.message === "UNAUTHORIZED_OR_NOT_FOUND") {
      return NextResponse.json({ error: "Item não encontrado ou acesso não autorizado" }, { status: 404 });
    }
    if (err.message === "INVALID_BLOCK_ID") {
      return NextResponse.json({ error: "Item não pertence a este bloco de estudo" }, { status: 400 });
    }
    if (err.message === "INVALID_STATUS") {
      return NextResponse.json({ error: "Item de cronograma não está pendente ou em andamento" }, { status: 400 });
    }
    if (err.message === "INVALID_SUBJECT_PRIORITY") {
      return NextResponse.json({ error: "Matéria inativa ou excluída do cronograma" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar item do cronograma", details: err.message },
      { status: 500 }
    );
  }
}
