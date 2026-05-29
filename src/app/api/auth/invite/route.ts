import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { Resend } from "resend";

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

    // ─── CENÁRIO 1: Produção ou Modo Real de Autenticação ──────────────────────
    if (isProd || authMode === "SUPABASE") {
      if (!adminClient) {
        const isProdEnv = process.env.NODE_ENV === "production";
        if (isProdEnv) {
          console.error("[InviteUser] Failed to send invite", {
            environment: "production",
            hasServiceRoleKey: false,
            hasInviteSecret: !!process.env.INVITE_SECRET,
            errorCode: "MISSING_SERVICE_ROLE_KEY"
          });
        } else {
          console.error("[INVITE ERROR] SUPABASE_SERVICE_ROLE_KEY está ausente no ambiente de desenvolvimento/produção.");
        }
        return NextResponse.json(
          { error: "Não foi possível processar o convite no momento. Verifique a configuração administrativa e tente novamente." },
          { status: 500 }
        );
      }

      let appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      
      // FORÇAR DOMÍNIO REAL EM PRODUÇÃO: Se for ambiente de produção ou se a origem da requisição for o domínio real, força o uso de kehlstudy.com
      const isProd = process.env.NODE_ENV === "production";
      if (isProd || request.nextUrl.origin.includes("kehlstudy.com")) {
        appUrl = "https://kehlstudy.com";
      }
      
      const redirectTo = `${appUrl}/auth/callback`;

      let authUserId: string | null = null;
      let actionLink: string | null = null;

      const resendApiKey = process.env.RESEND_API_KEY;
      const emailFrom = process.env.EMAIL_FROM || "Kehl Study <noreply@kehlstudy.com>";

      // Tenta gerar o link e enviar via Resend
      if (resendApiKey) {
        try {
          const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: "invite",
            email,
            options: {
              redirectTo,
              data: name ? { full_name: name } : undefined
            }
          });

          if (linkError) {
            throw new Error(`Erro ao gerar link de convite: ${linkError.message}`);
          }

          authUserId = linkData.user?.id || null;
          let rawLink = linkData.properties?.action_link || "";

          // CORREÇÃO P0: Se o link vier apontando para localhost devido a fallbacks do Supabase, substituir pelo appUrl de produção
          if (rawLink && rawLink.includes("localhost:3000")) {
            rawLink = rawLink.replace("http://localhost:3000", appUrl);
          } else if (rawLink && rawLink.includes("127.0.0.1:3000")) {
            rawLink = rawLink.replace("http://127.0.0.1:3000", appUrl);
          }
          actionLink = rawLink;

          const resend = new Resend(resendApiKey);
          const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kehl Study — Seu Convite Exclusivo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 20px;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    .header {
      background-color: #0f172a;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.025em;
    }
    .header p {
      color: #94a3b8;
      font-size: 14px;
      margin: 8px 0 0 0;
    }
    .content {
      padding: 40px;
      color: #334155;
    }
    .content p {
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }
    .content p.welcome {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 24px;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      background-color: #10b981;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      color: #64748b;
      font-size: 12px;
      margin: 0;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>🎓 Kehl Study</h1>
        <p>Sua Mente Aumentada por IA</p>
      </div>
      <div class="content">
        <p class="welcome">Olá, ${name || "Estudante"}!</p>
        <p>Você foi convidado com exclusividade para fazer parte do <strong>Kehl Study</strong>, a plataforma inteligente desenvolvida para transformar sua rotina de estudos e impulsionar sua aprovação.</p>
        <p>A partir de agora, você terá acesso a um ecossistema completo e personalizado projetado para organizar seus materiais, estruturar cronogramas de estudo dinâmicos e criar flashcards automatizados para suas revisões.</p>
        <div class="cta-container">
          <a href="${actionLink}" class="btn" style="color: #ffffff;">Aceitar Convite & Começar</a>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-top: 30px;">Se o botão acima não funcionar, você também pode copiar e colar o link abaixo em seu navegador:<br>
        <span style="word-break: break-all; color: #10b981;">${actionLink}</span></p>
      </div>
      <div class="footer">
        <p>Este é um convite de acesso único e exclusivo.<br>
        © ${new Date().getFullYear()} Kehl Study. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>
          `;

          const { error: resendError } = await resend.emails.send({
            from: emailFrom,
            to: email,
            subject: `🎓 Convite Especial: Seu acesso exclusivo ao Kehl Study`,
            html: emailHtml
          });

          if (resendError) {
            throw new Error(`Erro ao enviar e-mail via Resend: ${resendError.message}`);
          }

          console.info(`[INVITE RESEND] Convite enviado via Resend para ${email}`);

        } catch (err: any) {
          const isAlreadyRegistered = (err.message || "").toLowerCase().includes("already registered") || 
                                     (err.message || "").toLowerCase().includes("already exists") || 
                                     err.status === 422;
          if (isAlreadyRegistered) {
            return NextResponse.json({
              success: true,
              message: "Convite processado. Se o e-mail estiver apto, as instruções serão enviadas."
            });
          }
          console.error("Falha no fluxo customizado do Resend, caindo para o fallback nativo do Supabase:", err.message);
          // Fallback nativo
          actionLink = null;
        }
      }

      // Se falhou o Resend/generateLink ou se Resend não estava configurado, faz o fallback tradicional
      if (!actionLink) {
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: name ? { full_name: name } : undefined
        });

        if (inviteError) {
          const isAlreadyRegistered = (inviteError.message || "").toLowerCase().includes("already registered") || 
                                     (inviteError.message || "").toLowerCase().includes("already exists") || 
                                     inviteError.status === 422;
          if (isAlreadyRegistered) {
            return NextResponse.json({
              success: true,
              message: "Convite processado. Se o e-mail estiver apto, as instruções serão enviadas."
            });
          }

          const isProdEnv = process.env.NODE_ENV === "production";
          if (isProdEnv) {
            const maskedEmail = email.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, domain: string) => {
              return first + "*".repeat(Math.min(middle.length, 15)) + domain;
            });
            console.error("[InviteUser] Failed to send invite", {
              environment: "production",
              hasServiceRoleKey: true,
              hasInviteSecret: !!process.env.INVITE_SECRET,
              emailDomain: email.split("@")[1] || "unknown",
              errorCode: "SUPABASE_INVITE_FAILED",
              maskedEmail
            });
            return NextResponse.json(
              { error: "Não foi possível processar o convite no momento. Verifique a configuração administrativa e tente novamente." },
              { status: 500 }
            );
          } else {
            console.error("Erro ao convidar usuário no Supabase Auth:", inviteError.message);
            return NextResponse.json({ error: inviteError.message }, { status: 400 });
          }
        }

        authUserId = inviteData.user?.id || null;
      }

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

      const isProdEnv = process.env.NODE_ENV === "production";
      if (isProdEnv) {
        const maskedEmail = email.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, domain: string) => {
          return first + "*".repeat(Math.min(middle.length, 15)) + domain;
        });
        console.info(`[INVITE] Usuário ${maskedEmail} convidado com sucesso via Supabase.`);
      } else {
        console.info(`[INVITE] Usuário ${email} convidado com sucesso via Supabase.`);
      }
      return NextResponse.json({
        success: true,
        message: "Convite processado. Se o e-mail estiver apto, as instruções serão enviadas."
      });
    }

    // ─── CENÁRIO 2: Simulação de Desenvolvimento (AUTH_MODE=MOCK local) ────────
    console.info(`\n=== [SIMULAÇÃO DE CONVITE] ===`);
    console.info(`Nome: ${name || "Sem nome"}`);
    console.info(`E-mail: ${email}`);
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
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      console.error("[InviteUser] Failed to send invite due to internal server error", {
        environment: "production",
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasInviteSecret: !!process.env.INVITE_SECRET,
        errorCode: "INTERNAL_SERVER_ERROR"
      });
      return NextResponse.json(
        { error: "Não foi possível processar o convite no momento. Verifique a configuração administrativa e tente novamente." },
        { status: 500 }
      );
    }
    console.error("Erro na rota de convite:", err);
    return NextResponse.json({ error: "Erro interno no servidor ao processar convite." }, { status: 500 });
  }
}
