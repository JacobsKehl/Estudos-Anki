import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "gabriela.furtado.p@gmail.com" }
  });

  console.log("Gabriela Prisma User:", user?.id);

  const rawFlagged = await prisma.studyBlock.findMany({
    where: {
      userId: user!.id,
      possiblyAlreadyStudied: true,
      theoryStatus: { not: "COMPLETED" }
    },
    include: {
      subject: { select: { id: true, name: true } },
      material: { select: { id: true, originalFileName: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Prisma query rawFlagged count: ${rawFlagged.length}`);
  console.log("Sample titles:", rawFlagged.map(b => b.title).slice(0, 5));
}

main();
