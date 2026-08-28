import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Reclassificando os 2 cards remanescentes de Revisão Geral...");

  const procTrab = await prisma.studySubject.findFirst({ where: { name: "Direito Processual do Trabalho" } });
  const procCivil = await prisma.studySubject.findFirst({ where: { name: "Direito Processual Civil" } });

  if (!procTrab || !procCivil) {
    throw new Error("Matérias de destino não encontradas.");
  }

  // Card 1: Notificação 48h (Súmula 16 TST) -> Direito Processual do Trabalho
  await prisma.flashcard.update({
    where: { id: "cmsupopwr0003jr046i99th34" },
    data: { subjectId: procTrab.id }
  });
  console.log("Card cmsupopwr0003jr046i99th34 reclassificado para Direito Processual do Trabalho");

  // Card 2: Preclusão consumativa/temporal -> Direito Processual Civil
  await prisma.flashcard.update({
    where: { id: "cmswk0l0f0009l504ghdivdy4" },
    data: { subjectId: procCivil.id }
  });
  console.log("Card cmswk0l0f0009l504ghdivdy4 reclassificado para Direito Processual Civil");

  const trashSubjects = await prisma.studySubject.findMany({
    where: { name: { in: ["Revisão Geral TRT", "Revisão Geral"] } }
  });

  const trashSubjectIds = trashSubjects.map(s => s.id);
  const remainingCount = await prisma.flashcard.count({
    where: {
      subjectId: { in: trashSubjectIds },
      status: "APPROVED"
    }
  });

  console.log(`\nSELECT COUNT(*) de cards APPROVED nas Matérias-Lixo pós-ajuste: ${remainingCount} (Esperado: 0) ${remainingCount === 0 ? "✅" : "❌"}`);
}

main().finally(() => prisma.$disconnect());
