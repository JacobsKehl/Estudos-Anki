/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayRangeSP } from "@/lib/date-utils";
import { TRT4_STRATEGY } from "@/lib/strategies/trt4";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/fix-today-schedule
 *   → modo diagnóstico (read-only)
 *
 * POST /api/admin/fix-today-schedule
 *   → aplica a correção no banco de dados
 *
 * Protegido pelo CRON_SECRET para impedir acesso público.
 */

function verifySecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

async function diagnoseAndFix(apply: boolean) {
  const CYCLE = TRT4_STRATEGY.cycle;
  const log: string[] = [];
  const push = (msg: string) => { log.push(msg); console.log(msg); };

  push(apply ? "🔧 MODO APPLY" : "🔍 MODO DIAGNÓSTICO");

  // 1. Encontrar a Gabriela
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { name: { contains: "Gabriela", mode: "insensitive" } },
        { email: { contains: "gabriela", mode: "insensitive" } },
      ],
    },
  });
  if (!user) {
    user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  }
  if (!user) return { success: false, log, error: "Nenhum usuário encontrado" };
  const userId = user.id;
  push(`Usuário: ${user.name} (${user.email})`);

  // 2. Cronograma ativo
  const activeSchedule = await (prisma as any).studySchedule.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  if (!activeSchedule) return { success: false, log, error: "Nenhum cronograma ativo" };

  // 3. Itens de hoje
  const now = new Date();
  const { start: todayStart, end: todayEnd, dateString: todayStr } = getTodayRangeSP(now);
  push(`Data de hoje (SP): ${todayStr}`);

  const todayItems = await (prisma as any).studyScheduleItem.findMany({
    where: {
      userId,
      scheduleId: activeSchedule.id,
      scheduledDate: { gte: todayStart, lt: todayEnd },
      actionType: "THEORY",
    },
    include: {
      subject: true,
      studyBlock: { include: { material: true } },
    },
    orderBy: { priorityScore: "desc" },
  });

  push(`Total THEORY hoje: ${todayItems.length}`);
  for (const item of todayItems) {
    push(`  [${item.status}] ${item.subject?.name} — Bloco: ${item.studyBlock?.title || "?"} — ${item.estimatedMinutes || "?"}min`);
  }

  // 4. Verificar duplicatas
  const subjectCounts: Record<string, number> = {};
  for (const item of todayItems) {
    const name = item.subject?.name || "?";
    subjectCounts[name] = (subjectCounts[name] || 0) + 1;
  }

  const duplicates = Object.entries(subjectCounts).filter(([, count]) => (count as number) > 1);

  if (duplicates.length === 0) {
    push("✅ Nenhuma duplicata. Hoje já está correto.");
    return { success: true, log, action: "none", duplicates: [] };
  }

  push(`⚠️ DUPLICATAS: ${duplicates.map(([n, c]) => `${n} (${c}x)`).join(", ")}`);

  // 5. Determinar ciclo correto baseado no histórico
  const lastCompletedTheory = await (prisma as any).studyScheduleItem.findFirst({
    where: { userId, status: "COMPLETED", actionType: "THEORY" },
    include: { subject: true },
    orderBy: { completedAt: "desc" },
  });

  let inferredCycleDay: number | null = null;
  if (lastCompletedTheory?.completedAt) {
    const lastDate = lastCompletedTheory.completedAt;
    const lastRange = getTodayRangeSP(lastDate);
    const lastDayItems = await (prisma as any).studyScheduleItem.findMany({
      where: {
        userId,
        status: "COMPLETED",
        actionType: "THEORY",
        completedAt: { gte: lastRange.start, lt: lastRange.end },
      },
      include: { subject: true },
    });

    push(`Último dia de estudo (${lastRange.dateString}): ${lastDayItems.map((i: any) => i.subject?.name).join(", ")}`);

    for (let c = 0; c < CYCLE.length; c++) {
      const cycleNames = CYCLE[c].map(n => n.toLowerCase());
      const lastDaySubjectNames = lastDayItems.map((i: any) => (i.subject?.name?.toLowerCase() || ""));
      const matchCount = cycleNames.filter((cn: string) =>
        lastDaySubjectNames.some((dn: string) => dn.includes(cn) || cn.includes(dn))
      ).length;
      if (matchCount >= 1) {
        inferredCycleDay = (c + 1) % CYCLE.length;
        push(`Ciclo do último dia: Dia ${c + 1} → Hoje deveria ser Dia ${inferredCycleDay + 1}`);
        break;
      }
    }
  }

  const targetCycleDay = inferredCycleDay ?? 0;
  const targetSubjects = CYCLE[targetCycleDay];
  push(`🎯 CICLO ALVO: Dia ${targetCycleDay + 1} → ${targetSubjects.join(" + ")}`);

  // 6. Encontrar matérias faltando e sobrando
  const presentSubjectNames = [...new Set(todayItems.map((i: any) => i.subject?.name as string))] as string[];
  const missingSubjects = targetSubjects.filter(ts =>
    !presentSubjectNames.some(ps => ps && (ps as string).toLowerCase().includes(ts.toLowerCase()))
  );
  const duplicatedSubjectNames = duplicates.map(([name]) => name as string);

  push(`Presentes: ${presentSubjectNames.join(", ")}`);
  push(`Faltando: ${missingSubjects.length > 0 ? missingSubjects.join(", ") : "nenhuma"}`);

  const changes: any[] = [];

  if (missingSubjects.length === 0) {
    // Apenas duplicatas — remover extras
    if (apply) {
      for (const dupName of duplicatedSubjectNames) {
        const dupItems = todayItems.filter((i: any) => i.subject?.name === dupName);
        const toDelete = dupItems.slice(1);
        for (const item of toDelete) {
          push(`🗑️ Deletando duplicata: ${item.id} (${dupName})`);
          await (prisma as any).studyScheduleItem.delete({ where: { id: item.id } });
          changes.push({ action: "DELETE", itemId: item.id, subject: dupName });
        }
      }
    }
    return { success: true, log, action: "remove_duplicates", changes };
  }

  // 7. Substituir duplicatas por matérias faltando
  const allSubjects = await prisma.studySubject.findMany({ where: { userId } });

  for (const missingSubjectName of missingSubjects) {
    const targetSubject = allSubjects.find(s =>
      s.name.toLowerCase().includes(missingSubjectName.toLowerCase())
    );
    if (!targetSubject) {
      push(`❌ Matéria "${missingSubjectName}" não encontrada.`);
      continue;
    }

    // Buscar próximo bloco pendente
    const scheduledBlockIds = todayItems.map((i: any) => i.studyBlockId).filter(Boolean);
    const nextBlock = await (prisma as any).studyBlock.findFirst({
      where: {
        userId,
        subjectId: targetSubject.id,
        status: { not: "COMPLETED" },
        id: { notIn: scheduledBlockIds },
        material: { materialRole: { not: "SUPPORT_MATERIAL" } },
      },
      include: { material: true },
      orderBy: [{ orderIndex: "asc" }, { pageStart: "asc" }],
    });

    if (!nextBlock) {
      push(`⚠️ Nenhum bloco pendente para "${targetSubject.name}".`);
      continue;
    }

    push(`✅ Bloco encontrado: "${nextBlock.title}" — ${nextBlock.estimatedStudyMinutes || 45}min`);

    // Encontrar item duplicado a substituir
    const dupSubjectName = duplicatedSubjectNames[0];
    const dupItems = todayItems.filter((i: any) => i.subject?.name === dupSubjectName && i.status !== "COMPLETED");

    if (dupItems.length < 2) {
      push(`⚠️ Não há duplicata suficiente para substituir.`);
      continue;
    }

    const itemToReplace = dupItems[dupItems.length - 1];
    push(`📝 Substituir: [${itemToReplace.id}] ${dupSubjectName} → ${targetSubject.name} (bloco: ${nextBlock.title})`);

    if (apply) {
      await (prisma as any).studyScheduleItem.update({
        where: { id: itemToReplace.id },
        data: {
          subjectId: targetSubject.id,
          studyBlockId: nextBlock.id,
          reason: `Roteiro: Teoria de ${targetSubject.name} (Correção de ciclo)`,
          estimatedMinutes: nextBlock.estimatedStudyMinutes || 45,
        },
      });
      push(`✅ Item ${itemToReplace.id} corrigido!`);
      changes.push({
        action: "REPLACE",
        itemId: itemToReplace.id,
        oldSubject: dupSubjectName,
        newSubject: targetSubject.name,
        newBlock: nextBlock.title,
      });
    }
  }

  // Verificação final
  if (apply) {
    const finalItems = await (prisma as any).studyScheduleItem.findMany({
      where: {
        userId,
        scheduleId: activeSchedule.id,
        scheduledDate: { gte: todayStart, lt: todayEnd },
        actionType: "THEORY",
      },
      include: { subject: true, studyBlock: true },
      orderBy: { priorityScore: "desc" },
    });

    push("📋 ESTADO FINAL:");
    for (const item of finalItems) {
      push(`  [${item.status}] ${item.subject?.name} — Bloco: ${item.studyBlock?.title || "?"} — ${item.estimatedMinutes}min`);
    }
  }

  return { success: true, log, action: "fix_cycle", changes };
}

export async function GET(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await diagnoseAndFix(false);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Proteção em produção: exigir confirmação textual
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.confirm || body.confirm !== "SIM") {
      return NextResponse.json({
        error: "Confirmação necessária. Envie { \"confirm\": \"SIM\" } no body.",
      }, { status: 400 });
    }
  } catch {
    return NextResponse.json({
      error: "Confirmação necessária. Envie { \"confirm\": \"SIM\" } no body.",
    }, { status: 400 });
  }

  try {
    const result = await diagnoseAndFix(true);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
