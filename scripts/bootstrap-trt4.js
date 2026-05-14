const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function bootstrapTRT4() {
  const subjects = [
    { name: "Direito do Trabalho", examWeight: 2.0 },
    { name: "Direito Processual do Trabalho", examWeight: 2.0 },
    { name: "Direito Administrativo", examWeight: 1.0 },
    { name: "Direito Constitucional", examWeight: 1.0 },
    { name: "Direito Civil", examWeight: 1.0 },
    { name: "Direito Processual Civil", examWeight: 1.0 },
    { name: "Língua Portuguesa", examWeight: 1.0 },
    { name: "Matemática e Raciocínio Lógico", examWeight: 1.0 },
    { name: "Informática", examWeight: 1.0 },
    { name: "Direitos das Pessoas com Deficiência", examWeight: 1.0 },
  ];

  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found");

  console.log("Bootstrapping TRT4 subjects...");

  for (const sub of subjects) {
    const existing = await prisma.studySubject.findFirst({
      where: { userId: user.id, name: { contains: sub.name } }
    });

    if (existing) {
      await prisma.studySubject.update({
        where: { id: existing.id },
        data: { examWeight: sub.examWeight }
      });
      console.log(`- Updated ${sub.name} (Weight: ${sub.examWeight})`);
    } else {
      await prisma.studySubject.create({
        data: {
          name: sub.name,
          userId: user.id,
          examWeight: sub.examWeight,
          priority: 1
        }
      });
      console.log(`- Created ${sub.name} (Weight: ${sub.examWeight})`);
    }
  }

  console.log("Bootstrap complete.");
}

bootstrapTRT4()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
