import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT 
      s.id as "subjectId",
      s.name as "subjectName",
      COUNT(b.id)::int as "totalAnchors",
      COUNT(CASE WHEN b."theoryStatus" = 'COMPLETED' THEN 1 END)::int as "completedAnchors",
      COUNT(CASE WHEN b."theoryStatus" = 'NOT_STARTED' THEN 1 END)::int as "pendingAnchors"
    FROM "StudyBlock" b
    JOIN "StudyMaterial" m ON b."materialId" = m.id
    JOIN "StudySubject" s ON b."subjectId" = s.id
    WHERE b."userId" = $1 AND m."materialRole" = 'MAIN_MATERIAL'
    GROUP BY s.id, s.name
    ORDER BY s.name ASC
  `, gabriela.id);

  console.log("======================================================================");
  console.log("DISTRIBUIÇÃO DE BLOCOS ÂNCORA DO CFC POR MATÉRIA (GABRIELA)");
  console.log("======================================================================\n");

  console.log("| Subject ID (truncado) | Matéria | Total Âncora | Concluídos | Pendentes Agendáveis |");
  console.log("|---|---|---:|---:|---:|");
  rows.forEach(r => {
    console.log(`| \`${r.subjectId.substring(0, 8)}\` | ${r.subjectName} | ${r.totalAnchors} | ${r.completedAnchors} | ${r.pendingAnchors} |`);
  });

  const totalAll = rows.reduce((acc, r) => acc + r.totalAnchors, 0);
  const completedAll = rows.reduce((acc, r) => acc + r.completedAnchors, 0);
  const pendingAll = rows.reduce((acc, r) => acc + r.pendingAnchors, 0);

  console.log(`\nTOTAL GERAL: ${totalAll} blocos âncora (${completedAll} concluídos, ${pendingAll} pendentes agendáveis).`);
}

main().finally(() => prisma.$disconnect());
