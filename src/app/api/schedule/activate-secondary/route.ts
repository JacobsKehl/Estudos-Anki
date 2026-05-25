import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reorganizeActiveSchedule } from "@/lib/scheduler";
import { getMockUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    const body = await req.json().catch(() => ({}));
    const { subjectIds } = body;

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma matéria selecionada." },
        { status: 400 }
      );
    }

    // 1. Atualizar matérias secundárias selecionadas para ACTIVE
    await prisma.studySubject.updateMany({
      where: {
        id: { in: subjectIds },
        userId,
        studyPriority: "SECONDARY"
      },
      data: {
        studyPriority: "ACTIVE"
      }
    });

    // 2. Reorganizar apenas cronograma futuro pendente
    const result = await reorganizeActiveSchedule(userId, 30);

    return NextResponse.json({
      success: true,
      message: `${subjectIds.length} matéria(s) secundária(s) ativada(s) com sucesso.`,
      itemsCount: result ? result.itemsCount : 0
    });

  } catch (error: any) {
    console.error("[ACTIVATE SECONDARY SUBJECTS]", error);
    return NextResponse.json(
      { error: "Falha ao ativar matérias secundárias.", details: error.message },
      { status: 500 }
    );
  }
}
