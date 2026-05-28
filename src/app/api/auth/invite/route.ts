import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || "").toLowerCase().trim();
    const name = (body.name || "").trim();

    // 1. Validar e-mail informado
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }

    // 2. Validar Autorização (Sessão Admin OU Token Secreto)
    let isAuthorized = false;

    // A. Verificar Token Secreto no Header Authorization
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const inviteSecret = process.env.INVITE_SECRET;
      
      // Permitir bearer token apenas se INVITE_SECRET estiver expressamente configurado
      if (inviteSecret && token === inviteSecret) {
        isAuthorized = true;
      }
    }

    // B. Verificar Sessão do Usuário
    if (!isAuthorized) {
      const sessionUser = await getSessionUser();
      const adminEmail = process.env.ADMIN_EMAIL;

      if (sessionUser && adminEmail && sessionUser.email === adminEmail) {
        isAuthorized = true;
      }
    }

    // Retorna erro se não autorizado
    if (!isAuthorized) {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }

    // 3. Verificar se o e-mail já existe no banco local
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { preferences: true }
    });

    if (existingUser) {
      // Se já logou anteriormente, o usuário já está ativo e completo
      if (existingUser.lastLoginAt !== null) {
        return NextResponse.json({
          success: true,
          message: "Convite processado. Se o e-mail estiver apto, as instruções serão enviadas."
        });
      }
      // Se não logou ainda, prosseguiremos para tentar disparar o convite do Supabase
      // para reenvio das credenciais/link, mas sem duplicar no banco de dados.
    }

    const isProd = process.env.NODE_ENV === "production";
    const authMode = process.env.AUTH_MODE || "SUPABASE";
    const adminClient = createSupabaseAdminClient();

    const maskEmail = (e: string) => {
      const [local, domain] = e.split("@");
      if (!local || !domain) return "invalid-email";
      if (local.length <= 2) return `${local[0]}***@${domain}`;
      return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
    };

    // ─── CENÁRIO 1: Produção ou Modo Real de Autenticação ──────────────────────
    if (isProd || authMode === "SUPABASE") {
      if (!adminClient) {
        console.error(
          JSON.stringify({
            message: "[InviteUser] Failed to send invite",
            metadata: {
              environment: process.env.NODE_ENV,
              hasServiceRoleKey: false,
              hasInviteSecret: !!process.env.INVITE_SECRET,
              emailDomain: email.split("@")[1] || "unknown",
              errorCode: "SUPABASE_CLIENT_MISSING"
            }
          }, null, 2)
        );
        return NextResponse.json(
          { error: "Não foi possível processar o convite no momento. Verifique a configuração administrativa e tente novamente." },
          { status: 500 }
        );
      }

      const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const redirectTo = `${appUrl}/auth/callback`;

      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: name ? { full_name: name } : undefined
      });

      if (inviteError) {
        // Evitar expor se o e-mail já existe se a mensagem sugerir isso (retornar mensagem segura)
        if (inviteError.message.toLowerCase().includes("already registered") || inviteError.status === 422) {
          return NextResponse.json({
            success: true,
            message: "Convite processado. Se o e-mail estiver apto, as instruções serão enviadas."
          });
        }

        console.error(
          JSON.stringify({
            message: "[InviteUser] Failed to send invite",
            metadata: {
              environment: process.env.NODE_ENV,
              hasServiceRoleKey: true,
              hasInviteSecret: !!process.env.INVITE_SECRET,
              emailDomain: email.split("@")[1] || "unknown",
              errorCode: "SUPABASE_INVITE_FAILED"
            }
          }, null, 2)
        );

        return NextResponse.json(
          { error: "Não foi possível processar o convite no momento. Verifique a configuração administrativa e tente novamente." },
          { status: 500 }
        );
      }

      const authUserId = inviteData.user?.id || null;

      // Se o usuário não existia no Prisma local, criamos os registros com defaults
      if (!existingUser) {
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
      } else if (authUserId && !existingUser.authUserId) {
        // Se existia mas não tinha authUserId (ex: criado via mock local anterior), vinculamos
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { authUserId }
        });
      }

      console.info(`[INVITE] Usuário ${maskEmail(email)} convidado com sucesso via Supabase.`);
      return NextResponse.json({
        success: true,
        message: "Convite processado. Se o e-mail estiver apto, as instruções serão enviadas."
      });
    }

    // ─── CENÁRIO 2: Simulação de Desenvolvimento (AUTH_MODE=MOCK local) ────────
    console.info(`\n=== [SIMULAÇÃO DE CONVITE] ===`);
    console.info(`Nome: ${name || "Sem nome"}`);
    console.info(`E-mail: ${maskEmail(email)}`);
    console.info(`Link Simulado: ${request.nextUrl.origin}/login?email=${email}&mock_invite=true`);
    console.info(`==============================\n`);

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
    }

    return NextResponse.json({
      success: true,
      message: "Convite processado. Se o e-mail estiver apto, as instruções serão enviadas.",
      mock: true
    });

  } catch (err: any) {
    const parsedBody = await request.clone().json().catch(() => ({}));
    const reqEmail = (parsedBody.email || "").toLowerCase().trim();
    const emailDomain = reqEmail ? (reqEmail.split("@")[1] || "unknown") : "unknown";

    console.error(
      JSON.stringify({
        message: "[InviteUser] Failed to send invite",
        metadata: {
          environment: process.env.NODE_ENV,
          hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasInviteSecret: !!process.env.INVITE_SECRET,
          emailDomain,
          errorCode: "INTERNAL_SERVER_ERROR"
        }
      }, null, 2)
    );

    return NextResponse.json(
      { error: "Não foi possível processar o convite no momento. Verifique a configuração administrativa e tente novamente." },
      { status: 500 }
    );
  }
}
