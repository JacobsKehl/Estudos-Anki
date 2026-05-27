import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const userId = "cmp8od0wz0000iybklaotfqbs"; // Gabriela Furtado
  const activeScheduleId = "cmpl7swuh00cglh04rcv778us"; // Cronograma Ativo
  
  // Analisar os argumentos de linha de comando
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const isDryRun = args.includes("--dry-run") || !isApply;

  console.log("======================================================================");
  console.log("CORREÇÃO DE SOBRECARGA NO CRONOGRAMA DA GABRIELA FURTADO (27/05/2026)");
  console.log(`Modo: ${isApply ? "EXECUÇÃO REAL (--apply)" : "SIMULAÇÃO (--dry-run)"}`);
  console.log("======================================================================\n");

  try {
    // 1. Validar se o cronograma ativo realmente existe
    const activeSchedule = await prisma.studySchedule.findFirst({
      where: { id: activeScheduleId, userId, status: "ACTIVE" }
    });

    if (!activeSchedule) {
      console.error(`ERRO: Cronograma ativo com ID ${activeScheduleId} não encontrado.`);
      process.exit(1);
    }

    console.log(`Cronograma Ativo Encontrado: "${activeSchedule.title}"`);
    console.log(`Criado em: ${activeSchedule.createdAt.toISOString()}`);
    console.log(`Meta Diária: ${activeSchedule.dailyStudyMinutes} minutos\n`);

    // 2. Buscar TODOS os itens do cronograma ativo para fazer backup lógico
    const allScheduleItems = await prisma.studyScheduleItem.findMany({
      where: { scheduleId: activeScheduleId },
      include: {
        studyBlock: true,
        subject: true
      },
      orderBy: [
        { scheduledDate: "asc" },
        { dayNumber: "asc" }
      ]
    });

    console.log(`Total de itens cadastrados neste cronograma: ${allScheduleItems.length}`);

    // 3. Gerar Backup JSON Local
    const backupDir = path.join(__dirname, "../scratch");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(backupDir, "backup-schedule-2026-05-27-before-fix.json");
    
    const backupData = allScheduleItems.map(item => ({
      id: item.id,
      userId: item.userId,
      scheduleId: item.scheduleId,
      subjectId: item.subjectId,
      subjectName: item.subject.name,
      materialId: item.materialId,
      studyBlockId: item.studyBlockId,
      studyBlockTitle: item.studyBlock?.title || null,
      actionType: item.actionType,
      dayNumber: item.dayNumber,
      scheduledDate: item.scheduledDate ? item.scheduledDate.toISOString() : null,
      estimatedMinutes: item.estimatedMinutes,
      status: item.status,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    }));

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf-8");
    console.log(`[BACKUP] Backup lógico salvo em: ${backupPath}\n`);

    // 4. Filtrar os itens agendados para HOJE (27/05/2026) no cronograma ativo
    const todayItems = allScheduleItems.filter(item => {
      if (!item.scheduledDate) return false;
      const dateStr = item.scheduledDate.toISOString();
      return dateStr.includes("2026-05-27");
    });

    console.log(`=== Análise dos itens agendados para HOJE (27/05/2026) ===`);
    console.log(`Qtd total hoje: ${todayItems.length} itens`);
    
    const todayMinsTotal = todayItems.reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0);
    console.log(`Carga horária total recomendada hoje: ${todayMinsTotal} minutos\n`);

    // Separar os itens de hoje por dia do cronograma
    const day2Items = todayItems.filter(item => item.dayNumber === 2);
    const day7Items = todayItems.filter(item => item.dayNumber === 7);
    const day1Items = todayItems.filter(item => item.dayNumber === 1); // Reviews
    const otherDayItems = todayItems.filter(item => item.dayNumber !== 1 && item.dayNumber !== 2 && item.dayNumber !== 7);

    console.log(`Distribuição atual por dia de estudo em 27/05/2026:`);
    console.log(`- Dia 1 (Revisões Periódicas): ${day1Items.length} itens (${day1Items.reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0)} min)`);
    console.log(`- Dia 2 (Carga Correta de Teoria): ${day2Items.length} itens (${day2Items.reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0)} min)`);
    console.log(`- Dia 7 (Carga Excedente/Incorreta): ${day7Items.length} itens (${day7Items.reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0)} min)`);
    if (otherDayItems.length > 0) {
      console.log(`- Outros dias (Inesperados): ${otherDayItems.length} itens (${otherDayItems.reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0)} min)`);
    }
    console.log("");

    // 5. Identificar itens que serão MANTIDOS hoje
    const itemsToKeep = todayItems.filter(item => item.dayNumber === 2 || item.dayNumber === 1);
    console.log(`>>> ITENS QUE SERÃO MANTIDOS EM 27/05/2026 (${itemsToKeep.length} itens):`);
    itemsToKeep.forEach(item => {
      console.log(`  - [ID: ${item.id}] Dia ${item.dayNumber} | Tipo: ${item.actionType} | Minutos: ${item.estimatedMinutes} | Matéria: ${item.subject.name} | Bloco: ${item.studyBlock?.title || 'Cards de Revisão'}`);
    });
    console.log(`Carga de estudos correta mantida para hoje: ${itemsToKeep.reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0)} minutos.\n`);

    // 6. Identificar todos os itens futuros a serem MOVIDOS (dayNumber >= 7 e scheduledDate >= 2026-05-27 e status === 'PENDING')
    const itemsToMove = allScheduleItems.filter(item => {
      if (!item.scheduledDate || item.status !== "PENDING") return false;
      
      const dateStr = item.scheduledDate.toISOString();
      const isFromTodayOrFuture = dateStr >= "2026-05-27T00:00:00.000Z";
      
      // Mover todos os itens pendentes a partir do Dia 7 agendados para hoje ou no futuro
      return isFromTodayOrFuture && item.dayNumber >= 7;
    });

    console.log(`>>> ITENS QUE SERÃO ADIADOS / MOVIDOS POR +1 DIA (${itemsToMove.length} itens):`);
    console.log("Critério: status = PENDING, dayNumber >= 7, scheduledDate >= 27/05/2026");
    
    const shiftPlan = itemsToMove.map(item => {
      const originalDate = new Date(item.scheduledDate!);
      const newDate = new Date(originalDate);
      newDate.setUTCDate(originalDate.getUTCDate() + 1);
      
      return {
        item,
        originalDateStr: originalDate.toISOString(),
        newDateStr: newDate.toISOString()
      };
    });

    // Mostrar os primeiros 10 itens a serem movidos como exemplo
    shiftPlan.slice(0, 15).forEach(({ item, originalDateStr, newDateStr }) => {
      console.log(`  - [ID: ${item.id}] Dia ${item.dayNumber} | Matéria: ${item.subject.name}`);
      console.log(`    Bloco: ${item.studyBlock?.title || 'Cards de Revisão'}`);
      console.log(`    De: ${originalDateStr}  ==>  Para: ${newDateStr} (${item.estimatedMinutes} min)`);
    });
    
    if (shiftPlan.length > 15) {
      console.log(`  ... e mais ${shiftPlan.length - 15} itens pendentes que serão deslocados de forma consecutiva.`);
    }
    console.log("");

    // 7. Execução ou Simulação
    if (isDryRun) {
      console.log("----------------------------------------------------------------------");
      console.log("[DRY-RUN] Simulação concluída com sucesso!");
      console.log(`Nenhuma alteração foi feita no banco de dados.`);
      console.log(`Para aplicar as alterações reais com uma transação Prisma, execute:`);
      console.log(`  npx tsx scripts/fix-overloaded-schedule-2026-05-27.ts --apply`);
      console.log("----------------------------------------------------------------------");
    } else {
      console.log("Iniciando transação Prisma para aplicar o deslocamento de data...");
      
      // Executar a atualização em uma transação Prisma com timeout estendido para segurança total
      await prisma.$transaction(async (tx) => {
        let count = 0;
        for (const plan of shiftPlan) {
          await tx.studyScheduleItem.update({
            where: { id: plan.item.id },
            data: {
              scheduledDate: new Date(plan.newDateStr)
            }
          });
          count++;
        }
        console.log(`\n[SUCESSO] Transação concluída! ${count} itens de estudo atualizados.`);
      }, {
        maxWait: 60000, // 60 segundos
        timeout: 120000 // 120 segundos para latência de rede remota
      });

      console.log("\n----------------------------------------------------------------------");
      console.log("[APPLY] Execução real de correção concluída!");
      console.log("O cronograma de Gabriela Furtado foi reprogramado com sucesso.");
      console.log("Hoje (27/05/2026) restam apenas os blocos originais do Dia 2 e Dia 1.");
      console.log("A carga de estudos hoje foi restabelecida para a meta correta.");
      console.log("Todos os itens excedentes foram adiados por +1 dia consecutivos.");
      console.log("----------------------------------------------------------------------");
    }

  } catch (error) {
    console.error("ERRO durante a execução do script:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
