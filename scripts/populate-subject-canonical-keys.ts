import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// TABELA DE-PARA EXPLÍCITA E DETERMINÍSTICA
export const SUBJECT_CANONICAL_MAP: Record<string, string> = {
  "Língua Portuguesa": "PORTUGUESE",
  "Raciocínio Lógico-Matemático": "LOGIC_MATH",
  "Noções de Tecnologia da Informação": "TECH_INFO",
  "Direito Constitucional": "DIREITO_CONSTITUCIONAL",
  "Direito Processual do Trabalho": "DIREITO_PROCESSUAL_TRABALHO",
  "Direito do Trabalho": "DIREITO_TRABALHO",
  "Direito Processual Civil": "DIREITO_PROCESSUAL_CIVIL",
  "Direito Administrativo": "DIREITO_ADMINISTRATIVO",
};

async function main() {
  console.log("=======================================================================================");
  console.log(" POPULAÇÃO DE canonicalKey NAS MATÉRIAS (GABRIELA + CONTAS DE TESTE)");
  console.log("=======================================================================================\n");

  const subjects = await prisma.studySubject.findMany({
    include: { user: { select: { email: true, name: true } } },
  });

  console.log(`Total de matérias encontradas no banco: ${subjects.length}\n`);

  let updatedCount = 0;
  let unmappedCount = 0;

  for (const s of subjects) {
    const canonicalKey = SUBJECT_CANONICAL_MAP[s.name];
    const userLabel = `${s.user?.name || "Sem Nome"} (${s.user?.email || "Sem Email"})`;

    if (canonicalKey) {
      console.log(` [MAPEADO] ${s.name} -> canonicalKey: '${canonicalKey}' (User: ${userLabel})`);
      await (prisma.studySubject as any).update({
        where: { id: s.id },
        data: { canonicalKey },
      });
      updatedCount++;
    } else {
      console.log(` ⚠️ [NÃO MAPEADO] ${s.name} (User: ${userLabel}) - Permanece NULL`);
      unmappedCount++;
    }
  }

  console.log("\n---------------------------------------------------------------------------------------");
  console.log(` RESULTADO: ${updatedCount} matérias atualizadas com sucesso | ${unmappedCount} não mapeadas.`);
  console.log("=======================================================================================");
}

main()
  .catch((e) => {
    console.error("Erro ao popular canonicalKey:", e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
