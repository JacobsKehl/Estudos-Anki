/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

/**
 * POST /api/subjects/[id]/merge
 * Body: { targetSubjectId: string }
 *
 * Merges source subject (id) INTO target subject (targetSubjectId).
 * All materials, blocks, flashcards, and schedule items from source
 * are reassigned to the target, then source is deleted.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;
    const userId = await getMockUserId();
    const { targetSubjectId } = await req.json();

    if (!targetSubjectId || targetSubjectId === sourceId) {
      return NextResponse.json({ error: "ID de destino inválido." }, { status: 400 });
    }

    // Verify both subjects belong to the user
    const [source, target] = await Promise.all([
      prisma.studySubject.findUnique({ where: { id: sourceId, userId } }),
      prisma.studySubject.findUnique({ where: { id: targetSubjectId, userId } }),
    ]);

    if (!source || !target) {
      return NextResponse.json({ error: "Matéria de origem ou destino não encontrada." }, { status: 404 });
    }

    // Reassign all related records to the target subject
    await prisma.$transaction([
      prisma.studyMaterial.updateMany({
        where: { subjectId: sourceId },
        data: { subjectId: targetSubjectId },
      }),
      (prisma as any).studyBlock.updateMany({
        where: { subjectId: sourceId },
        data: { subjectId: targetSubjectId },
      }),
      (prisma as any).flashcard.updateMany({
        where: { subjectId: sourceId },
        data: { subjectId: targetSubjectId },
      }),
      (prisma as any).studyScheduleItem.updateMany({
        where: { subjectId: sourceId },
        data: { subjectId: targetSubjectId },
      }),
      (prisma as any).studySchedule.updateMany({
        where: { studySubjectId: sourceId },
        data: { studySubjectId: targetSubjectId },
      }),
    ]);

    // Delete the now-empty source subject
    await prisma.studySubject.delete({ where: { id: sourceId, userId } });

    return NextResponse.json({
      message: `"${source.name}" foi mesclada em "${target.name}" com sucesso.`,
      targetSubjectId,
    });

  } catch (error: any) {
    console.error("[MERGE SUBJECT]", error);
    return NextResponse.json({ error: "Erro ao mesclar matérias.", details: error.message }, { status: 500 });
  }
}
