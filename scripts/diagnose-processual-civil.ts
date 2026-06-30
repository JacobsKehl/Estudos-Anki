import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  try {
    const gabrielaEmail = "gabriela.furtado.p@gmail.com";
    console.log(`🔍 Buscando usuário Gabriela...`);
    const user = await prisma.user.findUnique({
      where: { email: gabrielaEmail }
    });

    if (!user) {
      console.error("❌ Gabriela não encontrada!");
      return;
    }

    // 1. Buscar a matéria de Direito Processual Civil
    const subject = await prisma.studySubject.findFirst({
      where: { userId: user.id, name: { contains: "Processual Civil" } }
    });

    if (!subject) {
      console.error("❌ Matéria de Direito Processual Civil não encontrada!");
      return;
    }

    console.log(`Matéria: ${subject.name} (ID: ${subject.id})`);

    // 2. Buscar todos os materiais cadastrados para essa matéria
    console.log("\n=== MATERIAIS DE DIREITO PROCESSUAL CIVIL ===");
    const materials = await prisma.studyMaterial.findMany({
      where: { userId: user.id, subjectId: subject.id }
    });

    for (const mat of materials) {
      const blocksCount = await prisma.studyBlock.count({
        where: { userId: user.id, materialId: mat.id }
      });
      const pendingBlocksCount = await prisma.studyBlock.count({
        where: { userId: user.id, materialId: mat.id, status: { not: "COMPLETED" } }
      });
      console.log(`- Nome: "${mat.fileName}" | ID: ${mat.id} | Função: ${mat.materialRole} | Total de Blocos: ${blocksCount} | Blocos Pendentes: ${pendingBlocksCount}`);
    }

    // 3. Buscar blocos da matéria que NÃO estão concluídos
    console.log("\n=== BLOCOS DE DIREITO PROCESSUAL CIVIL PENDENTES ===");
    const pendingBlocks = await prisma.studyBlock.findMany({
      where: {
        userId: user.id,
        subjectId: subject.id,
        status: { not: "COMPLETED" }
      },
      include: {
        material: true
      },
      orderBy: { orderIndex: "asc" },
      take: 10
    });

    if (pendingBlocks.length === 0) {
      console.log("Nenhum bloco pendente encontrado!");
    } else {
      pendingBlocks.forEach((block, idx) => {
        console.log(`- [${idx+1}] Bloco: "${block.title}" (ID: ${block.id}) | Status: ${block.status} | Material Role: ${block.material?.materialRole || "N/A"} | Material ID: ${block.materialId}`);
      });
    }

    // 4. Verificar se há agendamentos futuros ou passados do tipo THEORY para Direito Processual Civil
    console.log("\n=== ITENS DO CRONOGRAMA DE DIREITO PROCESSUAL CIVIL ===");
    const scheduleItems = await prisma.studyScheduleItem.findMany({
      where: {
        userId: user.id,
        subjectId: subject.id
      },
      include: {
        studyBlock: true
      },
      orderBy: { scheduledDate: "asc" }
    });

    console.log(`Total de agendamentos: ${scheduleItems.length}`);
    const theoryItems = scheduleItems.filter(item => item.actionType === "THEORY");
    console.log(`Agendamentos do tipo THEORY: ${theoryItems.length}`);
    theoryItems.forEach((item, idx) => {
      console.log(`  [${idx+1}] Bloco: "${item.studyBlock?.title || "N/A"}" (ID: ${item.studyBlockId}) | Data: ${item.scheduledDate?.toISOString()} | Status: ${item.status}`);
    });

  } catch (err: any) {
    console.error("❌ Erro no script:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
