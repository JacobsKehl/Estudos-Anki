import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("   INVESTIGAÇÃO ITEM 3: ANÁLISE DE SOBREPOSIÇÃO DE PÁGINAS EM TRABALHO");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  const trabalhoSubject = await prisma.studySubject.findFirst({
    where: { name: "Direito do Trabalho" }
  });

  const cfcTrabalhoMaterial = await prisma.studyMaterial.findFirst({
    where: {
      userId,
      originalFileName: { contains: "Direito do Trabalho" }
    }
  });

  if (!cfcTrabalhoMaterial) throw new Error("PDF do CFC de Direito do Trabalho não encontrado.");

  const blocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      materialId: cfcTrabalhoMaterial.id
    },
    select: {
      id: true,
      title: true,
      pageStart: true,
      pageEnd: true,
      createdAt: true,
      sourceV1BlockId: true,
      theoryStatus: true,
      possiblyAlreadyStudied: true
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Total de blocos no PDF '2 - Direito do Trabalho.pdf': ${blocks.length}\n`);

  const original13 = blocks.filter(b => b.createdAt.toISOString() < "2026-08-17T00:00:00.000Z");
  const new5 = blocks.filter(b => b.createdAt.toISOString() >= "2026-08-17T00:00:00.000Z");

  console.log(`- Blocos Originais do F1 (13/08): ${original13.length}`);
  console.log(`- Blocos Novos de Re-processamento (17/08 18:18): ${new5.length}\n`);

  console.log("--- FAIXAS DE PÁGINAS DOS 13 BLOCOS ORIGINAIS DO F1 ---");
  console.table(original13.map(b => ({
    id: b.id,
    pages: `pp. ${b.pageStart} - ${b.pageEnd}`,
    title: b.title.substring(0, 45),
    sourceV1: b.sourceV1BlockId ? "SIM" : "NÃO",
    status: b.theoryStatus
  })));

  console.log("\n--- FAIXAS DE PÁGINAS DOS 5 BLOCOS NOVOS DO RE-PROCESSAMENTO ---");
  console.table(new5.map(b => ({
    id: b.id,
    pages: `pp. ${b.pageStart} - ${b.pageEnd}`,
    title: b.title.substring(0, 45),
    sourceV1: b.sourceV1BlockId ? "SIM" : "NÃO",
    status: b.theoryStatus
  })));

  // Verificação de Sobreposição
  console.log("\n--- ANÁLISE DE SOBREPOSIÇÃO PÁGINA A PÁGINA ---");
  const overlaps: any[] = [];
  new5.forEach(n => {
    original13.forEach(o => {
      // Checa se as faixas [n.pageStart, n.pageEnd] e [o.pageStart, o.pageEnd] se sobrepõem
      const start = Math.max(n.pageStart, o.pageStart);
      const end = Math.min(n.pageEnd, o.pageEnd);
      if (start <= end) {
        overlaps.push({
          novoId: n.id,
          novoTitulo: n.title.substring(0, 30),
          faixaNova: `pp. ${n.pageStart}-${n.pageEnd}`,
          originalId: o.id,
          originalTitulo: o.title.substring(0, 30),
          faixaOriginal: `pp. ${o.pageStart}-${o.pageEnd}`,
          paginasSobrepostas: `pp. ${start}-${end}`
        });
      }
    });
  });

  if (overlaps.length > 0) {
    console.log(`⚠️ SOBREPOSIÇÃO DETECTADA! Os 5 blocos novos cobrem faixas de páginas já pertencentes aos 13 blocos originais!`);
    console.table(overlaps);
  } else {
    console.log(`✅ Nenhuma sobreposição de páginas encontrada entre os 5 novos e os 13 originais.`);
  }
}

main().finally(() => prisma.$disconnect());
