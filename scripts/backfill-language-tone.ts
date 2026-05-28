import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");

  if (!dryRun && !apply) {
    console.error("Erro: Especifique --dry-run ou --apply");
    process.exit(1);
  }

  console.log(`=== INICIANDO BACKFILL DE GÊNERO DE TRATAMENTO ===`);
  console.log(`Modo: ${dryRun ? "DRY-RUN (Sem alterações)" : "APPLY (Salvar no banco)"}`);

  const users = await prisma.user.findMany({
    include: { preferences: true }
  });

  console.log(`Total de usuários encontrados no banco: ${users.length}\n`);

  let updatedGabrielaCount = 0;
  let updatedOthersCount = 0;
  let skippedCount = 0;

  const gabrielaEmail = "gabriela.furtado.p@gmail.com";

  for (const user of users) {
    const email = user.email?.toLowerCase().trim();
    const isGabriela = email === gabrielaEmail;
    
    // Determinar o tom desejado
    const targetTone = isGabriela ? "FEMININE" : "MASCULINE_NEUTRAL";
    
    // Obter as preferências atuais
    const currentTone = user.preferences?.languageTone;
    
    if (currentTone === targetTone) {
      console.log(`- Usuário ${user.name || "Sem Nome"} (${user.email}): Já está configurado como ${currentTone}. Ignorando.`);
      skippedCount++;
      continue;
    }

    if (isGabriela) {
      console.log(`- [GABRIELA] Usuário ${user.name || "Gabriela Furtado"} (${user.email}): Alterando de '${currentTone || "NULO"}' para '${targetTone}'`);
      updatedGabrielaCount++;
    } else {
      console.log(`- [ESTUDANTE] Usuário ${user.name || "Estudante"} (${user.email}): Alterando de '${currentTone || "NULO"}' para '${targetTone}'`);
      updatedOthersCount++;
    }

    if (apply) {
      if (!user.preferences) {
        // Se não tiver preferências, cria usando as metas e defaults
        await prisma.userPreferences.create({
          data: {
            userId: user.id,
            languageTone: targetTone,
            displayName: user.name || "Estudante",
            focusArea: "Estudos",
            examGoal: "TRT",
          }
        });
      } else {
        // Se tiver, atualiza apenas o languageTone
        await prisma.userPreferences.update({
          where: { userId: user.id },
          data: { languageTone: targetTone }
        });
      }
    }
  }

  console.log(`\n=== RESUMO DO BACKFILL ===`);
  console.log(`Analisados: ${users.length}`);
  console.log(`Gabriela atualizada: ${updatedGabrielaCount}`);
  console.log(`Outros usuários atualizados: ${updatedOthersCount}`);
  console.log(`Ignorados (sem alterações necessárias): ${skippedCount}`);
  console.log(`===========================\n`);
  
  if (apply) {
    console.log("Alterações salvas com sucesso no banco de dados.");
  } else {
    console.log("Nenhuma alteração foi salva (modo --dry-run ativo).");
  }
}

main()
  .catch((e) => {
    console.error("Erro durante o backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
