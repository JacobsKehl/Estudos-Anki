import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.INVITE_EMAIL?.toLowerCase().trim();
  const name = process.env.INVITE_NAME?.trim() || "";

  if (!email) {
    console.error("ERRO: A variável de ambiente INVITE_EMAIL é obrigatória.");
    console.error("Exemplo de uso (PowerShell):");
    console.error("  $env:INVITE_EMAIL=\"henrique.j.kehl@gmail.com\"");
    console.error("  $env:INVITE_NAME=\"Henrique Kehl\"");
    console.error("  npx tsx scripts/invite-user.ts");
    process.exit(1);
  }

  // Validar e-mail informado
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error(`ERRO: O e-mail "${email}" informado é inválido.`);
    process.exit(1);
  }

  console.log("=== INICIANDO FLUXO DE CONVITE ===");
  console.log(`E-mail: ${email}`);
  console.log(`Nome: ${name || "(Não informado)"}`);

  try {
    // 1. Verificar se o e-mail já existe no banco local
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { preferences: true }
    });

    if (existingUser) {
      console.log(`Usuário já existe no Prisma local (ID: ${existingUser.id}).`);
      if (existingUser.lastLoginAt !== null) {
        console.log("Usuário já realizou login e está ativo. Não faremos novas alterações.");
        process.exit(0);
      }
      console.log("Usuário cadastrado mas pendente de login. Prosseguindo para reenvio.");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY;

    // Se estiver em produção ou se a service role key estiver presente, usar o Supabase real
    const isProd = process.env.NODE_ENV === "production";
    const hasServiceRoleKey = !!(supabaseUrl && serviceRoleKey);

    if (isProd && !hasServiceRoleKey) {
      console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY está ausente no ambiente de produção.");
      process.exit(1);
    }

    if (hasServiceRoleKey) {
      console.log("Configurando cliente de administração do Supabase...");
      const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const redirectTo = `${appUrl}/auth/callback`;

      console.log(`Enviando convite real via Supabase Auth (Redirect: ${redirectTo})...`);
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: name ? { full_name: name } : undefined
      });

      if (inviteError) {
        console.error(`Erro ao convidar no Supabase: ${inviteError.message}`);
        process.exit(1);
      }

      const authUserId = inviteData.user?.id || null;
      console.log(`Convite enviado com sucesso! Supabase User ID: ${authUserId}`);

      if (!existingUser) {
        console.log("Criando usuário e preferências no Prisma local...");
        const newUser = await prisma.user.create({
          data: {
            authUserId,
            email,
            name: name || email.split("@")[0] || "Estudante",
            lastLoginAt: null
          }
        });

        await prisma.userPreferences.create({
          data: {
            userId: newUser.id,
            displayName: name || email.split("@")[0] || "Estudante",
            languageTone: "MASCULINE_NEUTRAL",
            examGoal: "TRT",
            focusArea: "Estudos",
            dailyGoalMinutes: 120,
            emailReminderEnabled: false,
            theme: "light",
            visualDensity: "comfortable",
            flashcardDifficulty: "NORMAL",
            studyDaysOfWeek: "0,1,2,3,4,5,6"
          }
        });
        console.log("Usuário e preferências criados com sucesso.");
      } else if (authUserId && !existingUser.authUserId) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { authUserId }
        });
        console.log("Vínculo do authUserId atualizado no banco local.");
      }

    } else {
      // Cenário local mockado
      console.log("AUTH_MODE=MOCK ou chave de admin não configurada localmente. Rodando em modo simulado.");
      
      if (!existingUser) {
        const mockAuthUserId = `mock-auth-invite-${email.split("@")[0]}`;
        const newUser = await prisma.user.create({
          data: {
            authUserId: mockAuthUserId,
            email,
            name: name || email.split("@")[0] || "Estudante",
            lastLoginAt: null
          }
        });

        await prisma.userPreferences.create({
          data: {
            userId: newUser.id,
            displayName: name || email.split("@")[0] || "Estudante",
            languageTone: "MASCULINE_NEUTRAL",
            examGoal: "TRT",
            focusArea: "Estudos",
            dailyGoalMinutes: 120,
            emailReminderEnabled: false,
            theme: "light",
            visualDensity: "comfortable",
            flashcardDifficulty: "NORMAL",
            studyDaysOfWeek: "0,1,2,3,4,5,6"
          }
        });
        console.log("Usuário e preferências simulados foram criados no banco local.");
      }
      
      console.log(`\nLink de Login Simulado para testes locais:`);
      console.log(`http://localhost:3000/login?email=${email}&mock_invite=true\n`);
    }

    console.log("=== FLUXO CONCLUÍDO COM SUCESSO ===");
  } catch (error) {
    console.error("Erro inesperado durante a execução:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
