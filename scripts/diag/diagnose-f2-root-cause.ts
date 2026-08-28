import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  console.log("======================================================================");
  console.log("             DIAGNÓSTICO FRENTE 1 & FRENTE 2                          ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  // ─── FRENTE 1 (a): Diferenciação dos Blocos Concluídos em PostgreSQL ────────
  const completedBlocks = await prisma.studyBlock.findMany({
    where: { userId: gabriela.id, theoryStatus: "COMPLETED" },
    select: {
      id: true,
      title: true,
      sourceV1BlockId: true,
      possiblyAlreadyStudied: true,
      theoryCompletedAt: true
    }
  });

  const f1Precredited = completedBlocks.filter(b => b.sourceV1BlockId !== null);
  const appStudied = completedBlocks.filter(b => b.sourceV1BlockId === null);

  console.log("FRENTE 1 (a) — BLOCOS CONCLUÍDOS NO BANCO DE DADOS:");
  console.log(`- Total de blocos COMPLETED: ${completedBlocks.length}`);
  console.log(`- Pré-creditados pelo F1 (sourceV1BlockId != null): ${f1Precredited.length}`);
  console.log(`- Concluídos por estudo no app (sourceV1BlockId == null): ${appStudied.length}\n`);

  // ─── FRENTE 2 (1, 2, 3, 4): Diagnóstico do Insumo do Piloto F2 ──────────────
  const pilot1Id = "cmss35haq000hiyao4gxqyjj1"; // Lei 9.784/99
  const pilot1 = await prisma.studyBlock.findUnique({
    where: { id: pilot1Id },
    select: { id: true, title: true, officialTopicId: true, materialId: true, pageStart: true, pageEnd: true }
  });

  console.log("FRENTE 2 — DIAGNÓSTICO DO PILOTO 1 (Lei 9.784/99):");
  console.log(`- Bloco CFC ID: \`${pilot1Id.substring(0, 8)}\``);
  console.log(`- OfficialTopicId V2: \`${pilot1?.officialTopicId}\``);

  // Mapeamentos em SyllabusTopicMapping
  const mappings = await prisma.syllabusTopicMapping.findMany({
    where: { v2TopicId: pilot1?.officialTopicId! },
    include: { v1Topic: true, v2Topic: true }
  });

  console.log(`\n📋 SyllabusTopicMapping para \`${pilot1?.officialTopicId}\` (${mappings.length} mapeamento(s)):`);
  mappings.forEach(m => {
    console.log(`   - v1TopicId: \`${m.v1TopicId}\` (${m.v1Topic.title}) | relationType: ${m.relationType}`);
  });

  const v1TopicIds = mappings.map(m => m.v1TopicId);

  // Blocos de referência do Estratégia associados aos v1TopicIds
  const estrategiaBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      officialTopicId: { in: v1TopicIds },
      material: { materialRole: "REFERENCE_MATERIAL" }
    },
    select: {
      id: true,
      title: true,
      description: true,
      materialId: true,
      pageStart: true,
      pageEnd: true,
      material: { select: { fileName: true } }
    }
  });

  console.log(`\n📚 Blocos do Estratégia Trazidos pelo Insumo (${estrategiaBlocks.length} bloco(s)):`);
  for (const eb of estrategiaBlocks) {
    console.log(`   - ID: \`${eb.id.substring(0, 8)}\` | Título: "${eb.title}" | PDF: ${eb.material.fileName} (Págs ${eb.pageStart}-${eb.pageEnd})`);
    
    // Checar ExtractedContent destes blocos do Estratégia
    const extracted = await prisma.extractedContent.findMany({
      where: {
        materialId: eb.materialId,
        pageNumber: { gte: eb.pageStart, lte: eb.pageEnd }
      },
      orderBy: { pageNumber: "asc" },
      take: 2
    });

    const fullText = extracted.map(e => e.text).join("\n");
    console.log(`     Tamanho do ExtractedContent: ${fullText.length} caracteres`);
    console.log(`     Primeiros 200 chars de ExtractedContent: "${fullText.substring(0, 200).replace(/\n/g, " ")}..."\n`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
