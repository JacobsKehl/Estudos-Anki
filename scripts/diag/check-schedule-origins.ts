import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  // Buscar os blocos de teoria pendentes agendáveis (materialRole = MAIN_MATERIAL)
  const scheduledBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      theoryStatus: "NOT_STARTED",
      material: { materialRole: "MAIN_MATERIAL" }
    },
    select: {
      id: true,
      title: true,
      material: {
        select: {
          id: true,
          fileName: true,
          materialRole: true,
          provider: true
        }
      }
    },
    take: 15
  });

  console.log("======================================================================");
  console.log("ORIGEM DOS BLOCOS DA AGENDA (AMOSTRA DE BANCO DE DADOS)");
  console.log("======================================================================\n");

  console.log("| Bloco (ID truncado) | Título do Bloco | Material de Origem | Role | Provider |");
  console.log("|---|---|---|---|---|");
  scheduledBlocks.forEach(b => {
    const bId = b.id.substring(0, 8);
    const mName = b.material.fileName;
    const role = b.material.materialRole;
    const provider = b.material.provider;
    console.log(`| \`${bId}\` | ${b.title} | \`${mName}\` | ${role} | ${provider} |`);
  });
}

main().finally(() => prisma.$disconnect());
