import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseConfig } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp, rateLimitErrorResponse } from "@/lib/rate-limit";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    // 1. Validar se ENABLE_SIGNUP está ativo no servidor (Sempre desbloqueado em produção)
    const enableSignup = true;
    if (!enableSignup) {
      return NextResponse.json(
        { error: "O cadastro está temporariamente restrito. Entre em contato com o administrador para solicitar acesso." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const name = (body.name || "").trim();
    const email = (body.email || "").toLowerCase().trim();
    const password = body.password;
    const confirmPassword = body.confirmPassword;

    // 2. Validações básicas de campos
    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "As senhas não conferem." }, { status: 400 });
    }

    // 3. Rate Limiting: 5 tentativas a cada 15 minutos (900s) por IP + e-mail
    const ip = getClientIp(request);
    const rateLimitKey = `register:${ip}:${email}`;
    const rateCheck = await checkRateLimit(rateLimitKey, 5, 900);
    if (!rateCheck.success) {
      return rateLimitErrorResponse(rateCheck.reset);
    }

    // Safe recipient masking for logs
    const recipientMasked = email.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, domain: string) => {
      return first + "*".repeat(Math.min(middle.length, 10)) + domain;
    });

    // 4. Verificar se o e-mail já existe no Prisma local e se possui conta ativa (não mock)
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser && !existingUser.authUserId?.startsWith("mock-auth-")) {
      // Retornar resposta genérica de sucesso para evitar micro-ataques de enumeração de e-mails
      console.info(`[REGISTRATION SECURITY] Cadastro rejeitado silenciosamente: e-mail ${recipientMasked} já cadastrado no Prisma com ID ativo.`);
      return NextResponse.json({
        success: true,
        message: "Cadastro recebido! Se o e-mail for novo, enviamos um link de confirmação para a sua caixa de entrada."
      });
    }

    const { isConfigured } = getSupabaseConfig();

    // ─── CENÁRIO 1: Supabase não configurado (Simulação local de Dev) ───────────
    if (!isConfigured) {
      console.info(`\n=== [SIMULAÇÃO DE CADASTRO] ===`);
      console.info(`Nome: ${name}`);
      console.info(`E-mail: ${email}`);
      console.info(`===============================\n`);

      const mockAuthUserId = `mock-auth-${email.split("@")[0]}`;

      // Criar usuário e preferências no Prisma
      const newUser = await prisma.user.create({
        data: {
          authUserId: mockAuthUserId,
          email,
          name,
          lastLoginAt: null
        }
      });

      await prisma.userPreferences.create({
        data: {
          userId: newUser.id,
          displayName: name,
          examGoal: "Estudos",
          focusArea: "Geral",
          dailyGoalMinutes: 120,
          emailReminderEnabled: false,
          theme: "light",
          visualDensity: "comfortable",
          flashcardDifficulty: "NORMAL",
          studyResetTime: "00:00",
          studyDaysOfWeek: "0,1,2,3,4,5,6",
          languageTone: "MASCULINE_NEUTRAL",
          scheduleGenerationMode: "DYNAMIC"
        }
      });

      return NextResponse.json({
        success: true,
        message: "Cadastro recebido! Se o e-mail for novo, enviamos um link de confirmação para a sua caixa de entrada.",
        mock: true
      });
    }

    // ─── CENÁRIO 2: Supabase ativo e configurado (Bypass do SMTP do Supabase via Resend API) ───
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.error("[REGISTRATION ERROR] SUPABASE_SERVICE_ROLE_KEY está ausente no ambiente.");
      return NextResponse.json(
        { error: "Erro na configuração administrativa de autenticação. Tente novamente mais tarde." },
        { status: 500 }
      );
    }

    let authUserId: string | null = null;
    let actionLink = "";

    // 1. Criar o usuário administrativamente no Supabase Auth (sem disparar nenhum e-mail)
    const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Cria unconfirmed (pendente) para exigir ativação
      user_metadata: {
        full_name: name
      }
    });

    if (signUpError) {
      console.error("Erro ao criar usuário administrativamente no Supabase:", signUpError.message);
      
      // Se já existir no Supabase Auth, tentar gerar o link de signup caso esteja pendente de confirmação
      if (signUpError.message.toLowerCase().includes("already registered") || signUpError.status === 422) {
        console.info(`[REGISTRATION] E-mail ${recipientMasked} já cadastrado no Supabase Auth. Tentando gerar link de ativação para conta pendente.`);
        
        let appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
        if (process.env.NODE_ENV === "production" || request.nextUrl.origin.includes("kehlstudy.com")) {
          appUrl = "https://kehlstudy.com";
        }
        const redirectTo = `${appUrl}/auth/callback-handler`;

        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
          type: "signup",
          email,
          password: "", // String vazia para contas existentes
          options: {
            redirectTo
          }
        });

        if (linkError) {
          // Se falhar a geração de link (ex: porque a conta já está confirmada), retorna sucesso genérico de segurança
          console.info(`[REGISTRATION SECURITY] Conta já está confirmada ou ativa no Supabase Auth. Retornando sucesso genérico silencioso.`);
          return NextResponse.json({
            success: true,
            message: "Cadastro recebido! Se o e-mail for novo, enviamos um link de confirmação para a sua caixa de entrada."
          });
        }

        authUserId = linkData.user?.id || null;
        actionLink = linkData.properties?.action_link || "";
        
        // Garantir domínio correto no link se for gerado como localhost pelo Supabase
        if (actionLink && actionLink.includes("localhost:3000")) {
          actionLink = actionLink.replace("http://localhost:3000", appUrl);
        } else if (actionLink && actionLink.includes("127.0.0.1:3000")) {
          actionLink = actionLink.replace("http://127.0.0.1:3000", appUrl);
        }
      } else {
        return NextResponse.json({ error: signUpError.message }, { status: 400 });
      }
    } else {
      authUserId = signUpData.user?.id || null;
      if (!authUserId) {
        return NextResponse.json({ error: "Erro ao inicializar identidade de usuário no Supabase." }, { status: 400 });
      }

      // 2. Gerar o link seguro de ativação via Supabase Admin (Bypass de SMTP)
      let appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      if (process.env.NODE_ENV === "production" || request.nextUrl.origin.includes("kehlstudy.com")) {
        appUrl = "https://kehlstudy.com";
      }
      const redirectTo = `${appUrl}/auth/callback-handler`;

      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: {
          redirectTo
        }
      });

      if (linkError) {
        console.error("Erro ao gerar link seguro de ativação:", linkError.message);
        // Se falhar a geração de link, mantemos o usuário no Auth mas retornamos erro amigável permitindo reenvio
        return NextResponse.json({
          success: true,
          message: "Sua conta foi criada, mas não conseguimos gerar o link de confirmação no momento. Tente reenviar o link em alguns minutos."
        });
      }

      actionLink = linkData.properties?.action_link || "";
      // Garantir domínio correto no link se for gerado como localhost pelo Supabase
      if (actionLink && actionLink.includes("localhost:3000")) {
        actionLink = actionLink.replace("http://localhost:3000", appUrl);
      } else if (actionLink && actionLink.includes("127.0.0.1:3000")) {
        actionLink = actionLink.replace("http://127.0.0.1:3000", appUrl);
      }
    }

    // 3. Criar ou atualizar os registros correspondentes no Prisma (Apenas após o Auth estar garantido)
    let newUser;
    if (existingUser) {
      newUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          authUserId,
          name // Atualiza o nome de exibição local
        }
      });
      console.info(`[REGISTRATION] Conta local mock/convidada ${existingUser.id} vinculada ao novo authUserId real do Supabase: ${authUserId}`);
    } else {
      newUser = await prisma.user.create({
        data: {
          authUserId,
          email,
          name,
          lastLoginAt: null
        }
      });

      await prisma.userPreferences.create({
        data: {
          userId: newUser.id,
          displayName: name,
          examGoal: "Estudos",
          focusArea: "Geral",
          dailyGoalMinutes: 120,
          emailReminderEnabled: false,
          theme: "light",
          visualDensity: "comfortable",
          flashcardDifficulty: "NORMAL",
          studyResetTime: "00:00",
          studyDaysOfWeek: "0,1,2,3,4,5,6",
          languageTone: "MASCULINE_NEUTRAL",
          scheduleGenerationMode: "DYNAMIC"
        }
      });
    }

    // 4. Enviar o e-mail de ativação personalizado usando a API direta do Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || "Kehl Study <noreply@kehlstudy.com>";
    
    let resendMessageId: string | null = null;
    let emailSendSuccess = false;

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Confirme seu cadastro no Kehl Study</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
    .wrapper { width: 100%; padding: 40px 20px; box-sizing: border-box; }
    .card { max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background-color: #0f172a; padding: 40px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; }
    .content { padding: 40px; color: #334155; }
    .cta-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none; padding: 14px 32px; font-size: 14px; font-weight: 700; border-radius: 12px; }
    .footer { background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { color: #64748b; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>🎓 Kehl Study</h1>
      </div>
      <div class="content">
        <p style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 24px;">Olá, ${name}!</p>
        <p>Bem-vindo ao Kehl Study! Para ativar a sua conta de estudos e começar a organizar seu aprendizado inteligente com SRS e Inteligência Artificial, confirme o seu e-mail clicando no botão abaixo:</p>
        <div class="cta-container">
          <a href="${actionLink}" class="btn" style="color: #ffffff;">Confirmar E-mail & Ativar Conta</a>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-top: 30px;">Se o botão não funcionar, você também pode colar o link abaixo em seu navegador:<br>
        <span style="word-break: break-all; color: #10b981;">${actionLink}</span></p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Kehl Study. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>
        `;

        const resendResponse = await resend.emails.send({
          from: emailFrom,
          to: email,
          subject: "🎓 Ative sua conta no Kehl Study",
          html: emailHtml
        });

        if (resendResponse.error) {
          throw new Error(resendResponse.error.message);
        }

        resendMessageId = resendResponse.data?.id || null;
        emailSendSuccess = true;

      } catch (err: any) {
        console.error("Falha ao enviar e-mail de ativação via Resend API direta:", err.message);
      }
    } else {
      console.warn("RESEND_API_KEY ausente. E-mail de cadastro não pôde ser enviado.");
    }

    // 5. Logs estruturados seguros e resposta do usuário
    console.log(JSON.stringify({
      eventType: "signup_confirmation",
      provider: "resend_direct",
      recipientMasked,
      success: emailSendSuccess,
      messageId: resendMessageId,
      errorCode: emailSendSuccess ? null : "RESEND_SEND_FAILED",
      timestamp: new Date().toISOString()
    }));

    if (!emailSendSuccess) {
      // Regra: Se falhar o envio do Resend, informar o usuário de forma amigável para ele poder reenviar
      return NextResponse.json({
        success: true,
        message: "Sua conta foi criada, mas não conseguimos enviar o e-mail de confirmação agora. Tente reenviar o link em alguns minutos."
      });
    }

    return NextResponse.json({
      success: true,
      message: "Cadastro recebido! Se o e-mail for novo, enviamos um link de confirmação para a sua caixa de entrada."
    });

  } catch (err: any) {
    console.error("Erro crítico na rota de cadastro:", err);
    return NextResponse.json({ error: "Erro interno no servidor ao processar cadastro." }, { status: 500 });
  }
}
