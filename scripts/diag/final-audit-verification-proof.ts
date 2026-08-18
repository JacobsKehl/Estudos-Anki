import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("      RELATÓRIO COMPLETO DE COMPROVAÇÃO DE AUDITORIA DE FLASHCARDS    ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({
    where: { email: "gabriela.furtado.p@gmail.com" }
  });

  if (!gabriela) throw new Error("Usuária Gabriela não encontrada.");
  const userId = gabriela.id;

  // 1. SELECT status, COUNT(*) atual
  const statusGroup = await prisma.flashcard.groupBy({
    by: ["status"],
    where: { userId },
    _count: { id: true }
  });

  console.log("1. SELECT status, COUNT(*) ATUAL DA GABRIELA:");
  console.table(statusGroup.map(g => ({ status: g.status, count: g._count.id })));

  // 2. CONTAGEM POR MATÉRIA ATUAL (APENAS APPROVED)
  const activeCards = await prisma.flashcard.findMany({
    where: { userId, status: "APPROVED" },
    select: { subject: { select: { name: true } } }
  });

  const finalCounts: Record<string, number> = {};
  activeCards.forEach(c => {
    const sName = c.subject?.name || "Sem Matéria";
    finalCounts[sName] = (finalCounts[sName] || 0) + 1;
  });

  console.log("2. CONTAGEM FINAL POR MATÉRIA (CARDS 'APPROVED'):");
  console.table(finalCounts);

  // 3. MATÉRIAS-LIXO
  const trashSubjects = await prisma.studySubject.findMany({
    where: { name: { in: ["Revisão Geral TRT", "Revisão Geral"] } }
  });

  const trashSubjectIds = trashSubjects.map(s => s.id);
  const remainingTrashApprovedCards = await prisma.flashcard.count({
    where: {
      userId,
      subjectId: { in: trashSubjectIds },
      status: "APPROVED"
    }
  });

  console.log("3. STATUS DAS MATÉRIAS-LIXO:");
  trashSubjects.forEach(ts => {
    console.log(` - Matéria: '${ts.name}' | schedulingStatus: ${ts.schedulingStatus}`);
  });
  console.log(` - SELECT COUNT(*) de cards APPROVED nas Matérias-Lixo: ${remainingTrashApprovedCards} (Esperado: 0) ${remainingTrashApprovedCards === 0 ? "✅" : "❌"}\n`);

  // 4. ANÁLISE DOS CARDS DE JURISDIÇÃO VOLUNTÁRIA (ITEM 6 DA AUDITORIA)
  console.log("======================================================================");
  console.log("4. ANÁLISE DE CONTRADIÇÃO: JURISDIÇÃO VOLUNTÁRIA (ITEM 6):");
  console.log("======================================================================");

  const cardA = await prisma.flashcard.findUnique({
    where: { id: "cmrif88vl000zjr04mjwpd89v" },
    include: { subject: { select: { name: true } } }
  });

  const cardB = await prisma.flashcard.findUnique({
    where: { id: "cmq1hfxnw000bl504jazv1evb" },
    include: { subject: { select: { name: true } } }
  });

  if (cardA && cardB) {
    console.log(`- Card A [${cardA.id}] (${cardA.subject?.name}):`);
    console.log(`  Frente: "${cardA.question}"`);
    console.log(`  Verso:  "${cardA.answer}"`);
    console.log(`- Card B [${cardB.id}] (${cardB.subject?.name}):`);
    console.log(`  Frente: "${cardB.question}"`);
    console.log(`  Verso:  "${cardB.answer}"\n`);
  }
}

main().finally(() => prisma.$disconnect());
