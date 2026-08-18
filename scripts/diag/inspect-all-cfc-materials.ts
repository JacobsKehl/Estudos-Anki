import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");

  const materials = await prisma.studyMaterial.findMany({
    where: {
      userId: gabriela.id,
      originalFileName: { contains: "pdf" }
    },
    select: {
      id: true,
      originalFileName: true,
      materialRole: true,
      _count: { select: { studyBlocks: true } }
    }
  });

  console.table(materials.map(m => ({
    id: m.id,
    fileName: m.originalFileName,
    role: m.materialRole,
    blocksCount: m._count.studyBlocks
  })));
}

main().finally(() => prisma.$disconnect());
