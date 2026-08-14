import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const notes = await prisma.studyBlockGapNote.findMany({
    include: {
      studyBlock: { select: { id: true, title: true, officialTopicId: true, materialId: true, pageStart: true, pageEnd: true } }
    }
  });

  console.log("======================================================================");
  console.log("1. LOCALIZANDO ONDE SURGIU O 'Art. 143':");
  console.log("======================================================================\n");

  for (const n of notes) {
    if (n.status === "READY" && Array.isArray(n.gapItems)) {
      for (const item of (n.gapItems as string[])) {
        if (item.includes("143")) {
          console.log(`📌 ENCONTRADO NO BLOCO: "${n.studyBlock.title}" (ID: ${n.studyBlockId})`);
          console.log(`   Nota completa do bloco:`);
          (n.gapItems as string[]).forEach(it => console.log(`     ${it}`));
          console.log("");
        }
      }
    }
  }

  console.log("======================================================================");
  console.log("2. AUDITORIA RIGOROSA: CONFERÊNCIA DAS CITAÇÕES LEGAIS CONTRA O INSUMO");
  console.log("======================================================================\n");

  const readyNotes = notes.filter(n => n.status === "READY" && Array.isArray(n.gapItems));
  
  let totalCitations = 0;
  let verifiedInSource = 0;
  let hallucinatedInSource = 0;

  const auditResults: any[] = [];

  for (const note of readyNotes) {
    // Buscar insumo do CFC e do Estratégia para este bloco
    const cfcExt = await prisma.extractedContent.findMany({
      where: { materialId: note.studyBlock.materialId, pageNumber: { gte: note.studyBlock.pageStart, lte: note.studyBlock.pageEnd } },
      select: { text: true }
    });
    const cfcText = cfcExt.map(e => e.text).join("\n");

    let estrategiaText = "";
    if (note.studyBlock.officialTopicId) {
      const mappings = await prisma.syllabusTopicMapping.findMany({ where: { v2TopicId: note.studyBlock.officialTopicId } });
      const v1Ids = mappings.map(m => m.v1TopicId);
      const ebList = await prisma.studyBlock.findMany({
        where: { officialTopicId: { in: v1Ids }, material: { materialRole: "REFERENCE_MATERIAL" } },
        select: { materialId: true, pageStart: true, pageEnd: true }
      });
      for (const eb of ebList) {
        const ext = await prisma.extractedContent.findMany({
          where: { materialId: eb.materialId, pageNumber: { gte: eb.pageStart, lte: eb.pageEnd } },
          select: { text: true }
        });
        estrategiaText += ext.map(e => e.text).join("\n");
      }
    }

    const fullSourceText = (cfcText + "\n" + estrategiaText).toLowerCase();

    for (const item of (note.gapItems as string[])) {
      // Extrair artigos/súmulas específicos
      const matches = item.match(/(Art\.\s*\d+[A-Z\d\-\.,§\s]*|Súmula\s*\d+\s*do\s*TST|Súmula\s*\d+\s*do\s*STF|Súmula\s*\d+\s*do\s*STJ)/gi);
      if (matches) {
        for (const citation of matches) {
          totalCitations++;
          
          // Extrair apenas o número do artigo/súmula para checar no insumo
          const numMatch = citation.match(/\d+/);
          const num = numMatch ? numMatch[0] : "";

          // Checar se o número ou a citação aparece no insumo textual do Estratégia/CFC
          const inSource = fullSourceText.includes(citation.toLowerCase().trim()) || (num !== "" && fullSourceText.includes(num));

          if (inSource) {
            verifiedInSource++;
            auditResults.push({ block: note.studyBlock.title.substring(0, 30), citation: citation.trim(), inSource: true, item });
          } else {
            hallucinatedInSource++;
            auditResults.push({ block: note.studyBlock.title.substring(0, 30), citation: citation.trim(), inSource: false, item });
          }
        }
      }
    }
  }

  console.log(`- Total de Citações com Artigo/Súmula em TODAS as 45 Notas: ${totalCitations}`);
  console.log(`- Citações PRESENTES no Insumo de Origem (CFC/Estratégia): ${verifiedInSource}`);
  console.log(`- Citações AUSENTES do Insumo (Inventadas/Alucinadas): ${hallucinatedInSource}`);
  console.log(`- Taxa de Fundamentação no Insumo: ${((verifiedInSource / (totalCitations || 1)) * 100).toFixed(1)}%\n`);

  if (hallucinatedInSource > 0) {
    console.log("⚠️ LISTA DE CITAÇÕES AUSENTES DO INSUMO:");
    auditResults.filter(r => !r.inSource).forEach(r => {
      console.log(`  - [NÃO ENCONTRADO NO INSUMO] "${r.citation}" em "${r.block}..." -> Item: "${r.item}"`);
    });
  }
}

main().finally(() => prisma.$disconnect());
