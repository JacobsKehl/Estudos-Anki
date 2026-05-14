const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const subs = await prisma.studySubject.findMany({
    include: {
      _count: {
        select: { studyBlocks: true }
      }
    }
  });
  console.log("Subjects Found:");
  subs.forEach(s => {
    console.log(`- ${s.name}: ${s._count.studyBlocks} blocks (ID: ${s.id})`);
  });
}

check()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
