import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("          APLICAÇÃO DA AUDITORIA DE FLASHCARDS (GABRIELA)            ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({
    where: { email: "gabriela.furtado.p@gmail.com" }
  });

  if (!gabriela) {
    throw new Error("Usuária Gabriela não encontrada.");
  }
  const userId = gabriela.id;

  const duplicatasFile = path.join(process.cwd(), "duplicatas-final.json");
  const reclassificacaoFile = path.join(process.cwd(), "reclassificacao-final.json");

  const duplicatasData = JSON.parse(fs.readFileSync(duplicatasFile, "utf-8"));
  const reclassificacaoData: Array<{ id: string; de: string; para: string; assunto: string }> = JSON.parse(fs.readFileSync(reclassificacaoFile, "utf-8"));

  // ------------------------------------------------------------------
  // 0. ESTADO INICIAL (ANTES DE QUALQUER ALTERAÇÃO)
  // ------------------------------------------------------------------
  console.log("======================================================================");
  console.log("0. ESTADO INICIAL (ORIGINAL):");
  console.log("======================================================================");

  const initialStatusGroup = await prisma.flashcard.groupBy({
    by: ["status"],
    where: { userId },
    _count: { id: true }
  });
  console.log("\nSELECT status, COUNT(*) (Antes):");
  console.table(initialStatusGroup.map(g => ({ status: g.status, count: g._count.id })));

  const initialSubjectCards = await prisma.flashcard.findMany({
    where: { userId },
    select: { subject: { select: { name: true } } }
  });
  const initialSubjectCounts: Record<string, number> = {};
  initialSubjectCards.forEach(c => {
    const sName = c.subject?.name || "Sem Matéria";
    initialSubjectCounts[sName] = (initialSubjectCounts[sName] || 0) + 1;
  });
  console.log("Contagem por Matéria (Momento 1 - Original):");
  console.table(initialSubjectCounts);

  // Mapeamento de matérias por nome para fácil busca
  const allSubjects = await prisma.studySubject.findMany();
  const subjectMap = new Map<string, string>();
  allSubjects.forEach(s => subjectMap.set(s.name, s.id));

  // ------------------------------------------------------------------
  // 1. AS 5 MESCLAS ANTES DE ARQUIVAR
  // ------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("1. EXECUTANDO AS 5 MESCLAS DE CONTEÚDO:");
  console.log("======================================================================");

  // (1) Jus postulandi (cmponiiao000bl704hb5s0xe6)
  const cardJus = await prisma.flashcard.update({
    where: { id: "cmponiiao000bl704hb5s0xe6" },
    data: {
      answer: "Ação rescisória, ação cautelar, mandado de segurança, recursos ao TST e homologação de acordo extrajudicial (Súmula 425 TST, Art. 855-B CLT)."
    }
  });
  console.log("  [1/5] Mesclado 'Jus postulandi': ID cmponiiao000bl704hb5s0xe6");

  // (2) Improbidade (cmqslvja4000djm043pzpt087)
  const cardImp = await prisma.flashcard.update({
    where: { id: "cmqslvja4000djm043pzpt087" },
    data: {
      answer: "Suspensão dos direitos políticos, perda da função pública, indisponibilidade de bens e ressarcimento ao erário (Art. 37, § 4º da CF/88)."
    }
  });
  console.log("  [2/5] Mesclado 'Improbidade': ID cmqslvja4000djm043pzpt087");

  // (3) Honorários sucumbência JT (cmq1jhju20003lb04fd2l4jba)
  const cardHon = await prisma.flashcard.update({
    where: { id: "cmq1jhju20003lb04fd2l4jba" },
    data: {
      answer: "Mínimo de 5% e máximo de 15% sobre o valor da liquidação da sentença, proveito econômico ou valor da causa."
    }
  });
  console.log("  [3/5] Mesclado 'Honorários Sucumbência JT': ID cmq1jhju20003lb04fd2l4jba");

  // (4) Licença nojo professor (cmqu3vtjv000jjs04kcz1o1bg)
  const cardLic = await prisma.flashcard.update({
    where: { id: "cmqu3vtjv000jjs04kcz1o1bg" },
    data: {
      answer: "9 dias consecutivos, restrito ao falecimento de cônjuge, pai, mãe ou filho (Art. 320, §3º da CLT)."
    }
  });
  console.log("  [4/5] Mesclado 'Licença Nojo Professor': ID cmqu3vtjv000jjs04kcz1o1bg");

  // (5) Dano moral trabalhista -> cmpikn2om0017l204daaa2id1 será arquivado e cmpgygih60065iym0kxwfvpsf mantido
  console.log("  [5/5] Exceção 'Dano moral trabalhista': mantendo cmpgygih60065iym0kxwfvpsf e arquivando cmpikn2om0017l204daaa2id1 (erro de inglês)");

  // ------------------------------------------------------------------
  // 2. ARQUIVAR OS 71 CARDS DUPLICADOS
  // ------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("2. ARQUIVANDO OS 71 CARDS DUPLICADOS (status = 'ARCHIVED'):");
  console.log("======================================================================");

  let totalArchived = 0;
  for (const g of duplicatasData.grupos) {
    const manterId = g.manter;
    const removerIds: string[] = g.remover;
    const tema = g.tema;

    for (const removeId of removerIds) {
      await prisma.flashcard.update({
        where: { id: removeId },
        data: {
          status: "ARCHIVED",
          generationReason: `ARCHIVED_DUPLICATE | surviving_id=${manterId} | tema=${tema}`
        }
      });
      totalArchived++;
    }
  }

  console.log(`✅ Total de Cards Arquivados com Sucesso: ${totalArchived}`);

  // ------------------------------------------------------------------
  // CONTAGEM POR MATÉRIA (MOMENTO 2 - PÓS-ARQUIVAMENTO E PRÉ-RECLASSIFICAÇÃO)
  // ------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("CONTAGEM POR MATÉRIA (MOMENTO 2 - PÓS-ARQUIVAMENTO / PRÉ-RECLASSIFICAÇÃO):");
  console.log("======================================================================");

  // Considerando apenas cards ATIVOS (APPROVED)
  const postArchiveApprovedCards = await prisma.flashcard.findMany({
    where: { userId, status: "APPROVED" },
    select: { subject: { select: { name: true } } }
  });
  const postArchiveCounts: Record<string, number> = {};
  postArchiveApprovedCards.forEach(c => {
    const sName = c.subject?.name || "Sem Matéria";
    postArchiveCounts[sName] = (postArchiveCounts[sName] || 0) + 1;
  });
  console.table(postArchiveCounts);
  console.log(`Total de Cards Ativos (APPROVED): ${postArchiveApprovedCards.length}`);

  // ------------------------------------------------------------------
  // 3. RECLASSIFICAÇÃO DOS 111 CARDS DE MATÉRIA
  // ------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("3. RECLASSIFICANDO OS 111 CARDS DE MATÉRIA:");
  console.log("======================================================================");

  let totalReclassified = 0;
  let unlinkedBlocksCount = 0;

  for (const item of reclassificacaoData) {
    const targetSubjectId = subjectMap.get(item.para);
    if (!targetSubjectId) {
      throw new Error(`🔴 Matéria de destino '${item.para}' não encontrada no banco!`);
    }

    const currentCard = await prisma.flashcard.findUnique({
      where: { id: item.id },
      include: { studyBlock: true }
    });

    let newBlockId = currentCard?.studyBlockId;
    if (currentCard?.studyBlock && currentCard.studyBlock.subjectId !== targetSubjectId) {
      newBlockId = null; // Desvincula do bloco da matéria antiga para evitar inconsistência relacional
      unlinkedBlocksCount++;
    }

    await prisma.flashcard.update({
      where: { id: item.id },
      data: {
        subjectId: targetSubjectId,
        studyBlockId: newBlockId
      }
    });
    totalReclassified++;
  }

  console.log(`✅ Total de Cards Reclassificados com Sucesso: ${totalReclassified}`);
  console.log(`   (Blocos desvinculados por incompatibilidade de matéria: ${unlinkedBlocksCount})`);

  // ------------------------------------------------------------------
  // 4. DESATIVAR AS DUAS MATÉRIAS-LIXO
  // ------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("4. DESATIVANDO AS MATÉRIAS-LIXO (Revisão Geral TRT e Revisão Geral):");
  console.log("======================================================================");

  const trashSubjectNames = ["Revisão Geral TRT", "Revisão Geral"];
  const trashSubjectIds: string[] = [];

  for (const tName of trashSubjectNames) {
    const subId = subjectMap.get(tName);
    if (subId) {
      trashSubjectIds.push(subId);
      await prisma.studySubject.update({
        where: { id: subId },
        data: { schedulingStatus: "ARCHIVED" } // Desativa sem apagar (respeita FKs)
      });
      console.log(`  Desativada matéria-lixo '${tName}' (ID: ${subId})`);
    }
  }

  // ------------------------------------------------------------------
  // 5. PROVA FINAL E VERIFICAÇÕES
  // ------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("5. PROVA FINAL E COMPROVAÇÃO DE RESULTADOS:");
  console.log("======================================================================");

  // Query SELECT status, COUNT(*) após aplicação
  const finalStatusGroup = await prisma.flashcard.groupBy({
    by: ["status"],
    where: { userId },
    _count: { id: true }
  });
  console.log("\nSELECT status, COUNT(*) (Depois da aplicação):");
  console.table(finalStatusGroup.map(g => ({ status: g.status, count: g._count.id })));

  // Contagem por Matéria (Momento 3 - Pós-Reclassificação)
  const finalSubjectCards = await prisma.flashcard.findMany({
    where: { userId, status: "APPROVED" },
    select: { subject: { select: { name: true } } }
  });
  const finalSubjectCounts: Record<string, number> = {};
  finalSubjectCards.forEach(c => {
    const sName = c.subject?.name || "Sem Matéria";
    finalSubjectCounts[sName] = (finalSubjectCounts[sName] || 0) + 1;
  });
  console.log("\nContagem por Matéria (Momento 3 - Pós-Reclassificação - Apenas Cards APPROVED):");
  console.table(finalSubjectCounts);

  // Verificação SELECT COUNT(*) das matérias-lixo
  const trashCardsCount = await prisma.flashcard.count({
    where: {
      userId,
      subjectId: { in: trashSubjectIds },
      status: "APPROVED"
    }
  });
  console.log(`\nSELECT COUNT(*) de cards APPROVED nas Matérias-Lixo: ${trashCardsCount} (Esperado: 0) ${trashCardsCount === 0 ? "✅" : "❌"}`);
}

main().finally(() => prisma.$disconnect());
