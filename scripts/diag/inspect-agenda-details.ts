import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("    DIAGNÓSTICO PROFUNDO: AGENDA ATIVA, CÓDIGO DA PÁGINA E BANNER     ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  // 1. Busca a agenda ACTIVE
  const activeSchedule = await prisma.studySchedule.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      items: {
        include: {
          studyBlock: true,
          subject: { select: { name: true } }
        },
        orderBy: { dayNumber: "asc" }
      }
    }
  });

  if (!activeSchedule) {
    console.log("❌ NENHUMA AGENDA ATIVA (ACTIVE) ENCONTRADA PARA A GABRIELA!");
  } else {
    console.log(`✅ Agenda Ativa Encontrada: ID '${activeSchedule.id}' | Título: '${activeSchedule.title}' | Início: ${activeSchedule.startDate.toISOString()}`);
    console.log(`Total de itens na agenda ativa: ${activeSchedule.items.length}`);

    const now = new Date("2026-08-18T00:00:00.000Z");
    console.log(`\nItens da Agenda Ativa para a data de Hoje (${now.toISOString().substring(0, 10)}):`);
    
    const todayItems = activeSchedule.items.filter(it => {
      if (!it.scheduledDate) return false;
      const d = new Date(it.scheduledDate).toISOString().substring(0, 10);
      return d === "2026-08-18";
    });

    console.log(`Encontrados ${todayItems.length} itens agendados para HOJE (2026-08-18):`);
    todayItems.forEach(it => {
      console.log(` - ID: ${it.id} | Action: ${it.actionType} | Status: ${it.status} | Matéria: ${it.subject?.name} | BlocoId: ${it.studyBlockId} | BlocoTitle: '${it.studyBlock?.title}' | sourceV1BlockId: ${it.studyBlock?.sourceV1BlockId} | possiblyAlreadyStudied: ${it.studyBlock?.possiblyAlreadyStudied}`);
    });

    console.log(`\nItens da Agenda Ativa para AMANHÃ (2026-08-19):`);
    const tomorrowItems = activeSchedule.items.filter(it => {
      if (!it.scheduledDate) return false;
      const d = new Date(it.scheduledDate).toISOString().substring(0, 10);
      return d === "2026-08-19";
    });
    console.log(`Encontrados ${tomorrowItems.length} itens agendados para AMANHÃ (2026-08-19):`);
    tomorrowItems.forEach(it => {
      console.log(` - ID: ${it.id} | Action: ${it.actionType} | Status: ${it.status} | Matéria: ${it.subject?.name} | BlocoId: ${it.studyBlockId} | BlocoTitle: '${it.studyBlock?.title}' | sourceV1BlockId: ${it.studyBlock?.sourceV1BlockId}`);
    });

    // Vamos ver itens COMPLETED recentemente (hoje)
    const recentlyCompleted = activeSchedule.items.filter(it => it.status === "COMPLETED");
    console.log(`\nTotal de Itens com Status COMPLETED na Agenda Ativa: ${recentlyCompleted.length}`);
    recentlyCompleted.forEach(it => {
      console.log(` - Day ${it.dayNumber} | ScheduledDate: ${it.scheduledDate?.toISOString().substring(0, 10)} | CompletedAt: ${it.completedAt?.toISOString()} | Bloco: [${it.studyBlockId}] '${it.studyBlock?.title}' | sourceV1BlockId: ${it.studyBlock?.sourceV1BlockId} | possiblyAlreadyStudied: ${it.studyBlock?.possiblyAlreadyStudied}`);
    });
  }
}

main().finally(() => prisma.$disconnect());
