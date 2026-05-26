import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const authUserId = process.env.LINK_AUTH_USER_ID;
  const email = process.env.LINK_AUTH_EMAIL?.toLowerCase().trim();

  if (!authUserId || !email) {
    console.error("ERRO: As variáveis de ambiente LINK_AUTH_USER_ID e LINK_AUTH_EMAIL são obrigatórias.");
    console.error("Exemplo de uso:");
    console.error("  $env:LINK_AUTH_USER_ID=\"uuid-do-supabase\"");
    console.error("  $env:LINK_AUTH_EMAIL=\"gabriela.furtado.p@gmail.com\"");
    console.error("  npx tsx scripts/link-current-user-to-auth.ts");
    process.exit(1);
  }

  try {
    console.log("--------------------------------------------------");
    console.log(`Buscando usuários existentes no banco para vincular...`);
    
    // 1. Procurar todos os usuários locais
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" }
    });

    if (users.length === 0) {
      console.log("Nenhum usuário encontrado no banco de dados para vincular.");
      process.exit(0);
    }

    console.log(`Encontrados ${users.length} usuários locais no banco.`);

    // 2. Localizar o usuário correto para vinculação.
    // Daremos preferência ao primeiro usuário cadastrado (comum no MVP/dev).
    const targetUser = users[0];

    console.log(`\nUsuário selecionado para vinculação:`);
    console.log(`- ID Interno: ${targetUser.id}`);
    console.log(`- Nome Atual: ${targetUser.name || "Sem nome"}`);
    console.log(`- E-mail Atual: ${targetUser.email || "Sem e-mail"}`);
    console.log(`- authUserId Atual: ${targetUser.authUserId || "Nulo"}`);

    console.log(`\nVinculando para os novos dados do Supabase Auth:`);
    console.log(`- Novo authUserId: ${authUserId}`);
    console.log(`- Novo e-mail: ${email}`);

    // 3. Executar o update
    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        authUserId,
        email,
        name: targetUser.name || "Gabriela Furtado",
        lastLoginAt: new Date()
      }
    });

    console.log(`\n[SUCESSO] Usuário vinculado com sucesso!`);
    console.log(`- ID Interno (PRESERVADO): ${updatedUser.id}`);
    console.log(`- Novo authUserId: ${updatedUser.authUserId}`);
    console.log(`- Novo E-mail: ${updatedUser.email}`);
    console.log(`- Nome: ${updatedUser.name}`);
    console.log("Todos os relacionamentos, preferências, materiais e blocos foram preservados.");
    console.log("--------------------------------------------------");

  } catch (error) {
    console.error("Erro durante a vinculação do usuário:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
