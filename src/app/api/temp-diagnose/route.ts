import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const gabrielaEmail = "gabriela.furtado.p@gmail.com";
    const user = await prisma.user.findUnique({
      where: { email: gabrielaEmail },
    });

    if (!user) {
      return NextResponse.json({ error: "Gabriela not found" });
    }

    const userId = user.id;

    // 1. Obter todas as matérias da Gabriela
    const subjects = await prisma.studySubject.findMany({
      where: { userId },
      orderBy: { name: "asc" }
    });

    // 2. Para cada matéria, contar blocos totais e blocos pendentes/concluídos
    const subjectsStats = [];
    for (const sub of subjects) {
      const totalBlocks = await prisma.studyBlock.count({
        where: { userId, subjectId: sub.id }
      });
      const completedBlocks = await prisma.studyBlock.count({
        where: { userId, subjectId: sub.id, status: "COMPLETED" }
      });
      const pendingBlocks = await prisma.studyBlock.count({
        where: { userId, subjectId: sub.id, status: { not: "COMPLETED" } }
      });

      subjectsStats.push({
        id: sub.id,
        name: sub.name,
        priority: sub.studyPriority,
        totalBlocks,
        completedBlocks,
        pendingBlocks
      });
    }

    // 3. Obter todos os blocos de Direito Processual Civil especificamente
    const procCivilSubject = subjects.find(s => s.name.toLowerCase().includes("processual civil"));
    let procCivilBlocks: any[] = [];
    if (procCivilSubject) {
      procCivilBlocks = await prisma.studyBlock.findMany({
        where: { userId, subjectId: procCivilSubject.id },
        select: {
          id: true,
          title: true,
          status: true,
          orderIndex: true,
          pageStart: true,
          pageEnd: true,
        },
        orderBy: { orderIndex: "asc" }
      });
    }

    // 4. Buscar os itens agendados para hoje
    const todayItems = await prisma.studyScheduleItem.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] }
      },
      include: {
        subject: { select: { name: true } },
        studyBlock: { select: { title: true } }
      },
      orderBy: { scheduledDate: "asc" }
    });

    // Vamos filtrar apenas os itens de 30/06/2026 no fuso de SP
    // (entre 2026-06-30T03:00:00.000Z e 2026-07-01T02:59:59.999Z)
    const startOfToday = new Date("2026-06-30T00:00:00-03:00");
    const endOfToday = new Date("2026-06-30T23:59:59.999-03:00");

    const todayFiltered = todayItems.filter(item => {
      if (!item.scheduledDate) return false;
      const d = new Date(item.scheduledDate);
      return d >= startOfToday && d <= endOfToday;
    });

    return NextResponse.json({
      success: true,
      user: { id: userId, email: user.email, name: user.name },
      subjectsStats,
      procCivilSubject: procCivilSubject ? { id: procCivilSubject.id, name: procCivilSubject.name, priority: procCivilSubject.studyPriority } : null,
      procCivilBlocks,
      todayFiltered
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
