import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp, rateLimitErrorResponse } from "@/lib/rate-limit";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    let email: string | undefined;

    // Se estiver logado, usa o e-mail da sessão (seguro)
    if (user && user.email) {
      email = user.email;
    } else {
      // Se não estiver logado (fluxo público), tenta obter do payload
      try {
        const body = await request.json().catch(() => ({}));
        email = body.email;
      } catch {
        // Ignora
      }
    }

    if (!email) {
      return NextResponse.json({ error: "E-mail é obrigatório" }, { status: 400 });
    }

    const emailKey = email.toLowerCase().trim();

    // Rate Limiting: 1 tentativa por 60 segundos por IP + e-mail
    const ip = getClientIp(request);
    const rateLimitKey = `resend-verification:${ip}:${emailKey}`;
    const rateCheck = await checkRateLimit(rateLimitKey, 1, 60);
    if (!rateCheck.success) {
      return rateLimitErrorResponse(rateCheck.reset);
    }

    // Safe recipient masking for logs
    const recipientMasked = emailKey.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, domain: string) => {
      return first + "*".repeat(Math.min(middle.length, 10)) + domain;
    });

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.error("[RESEND VERIFICATION ERROR] SUPABASE_SERVICE_ROLE_KEY está ausente.");
      return NextResponse.json(
        { error: "Erro na configuração administrativa. Tente novamente mais tarde." },
        { status: 500 }
      );
    }

    // 1. Gerar o link seguro de ativação via Supabase Admin (Bypass de SMTP)
    let appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    if (process.env.NODE_ENV === "production" || request.nextUrl.origin.includes("kehlstudy.com")) {
      appUrl = "https://kehlstudy.com";
    }
    const redirectTo = `${appUrl}/auth/callback`;

    let resendMessageId: string | null = null;
    let emailSendSuccess = false;

    // Tentamos gerar o link. Se o usuário não existir no Supabase Auth, gerará erro.
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "signup",
      email: emailKey,
      password: "", // String vazia para satisfazer tipagem estática GenerateSignupLinkParams
      options: {
        redirectTo
      }
    });

    if (linkError) {
      // Se der erro (ex: user not found), silenciamos se for público para evitar enumeração
      console.warn(`[Resend Verification] Erro ao gerar link no Supabase (esperado se não cadastrado):`, linkError.message);
    } else {
      let actionLink = linkData.properties?.action_link || "";
      if (actionLink && actionLink.includes("localhost:3000")) {
        actionLink = actionLink.replace("http://localhost:3000", appUrl);
      } else if (actionLink && actionLink.includes("127.0.0.1:3000")) {
        actionLink = actionLink.replace("http://127.0.0.1:3000", appUrl);
      }

      // 2. Disparar o e-mail via Resend API direta
      const resendApiKey = process.env.RESEND_API_KEY;
      const emailFrom = process.env.EMAIL_FROM || "Kehl Study <noreply@kehlstudy.com>";

      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Confirme seu e-mail no Kehl Study</title>
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
        <p style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 24px;">Olá!</p>
        <p>Você solicitou um novo link de ativação para a sua conta no Kehl Study. Para confirmar o seu e-mail e acessar a plataforma, clique no botão abaixo:</p>
        <div class="cta-container">
          <a href="${actionLink}" class="btn" style="color: #ffffff;">Confirmar E-mail & Ativar Conta</a>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-top: 30px;">Se o botão não funcionar, você também pode copiar e colar o link abaixo em seu navegador:<br>
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
            to: emailKey,
            subject: "🎓 Novo Link de Ativação - Kehl Study",
            html: emailHtml
          });

          if (resendResponse.error) {
            throw new Error(resendResponse.error.message);
          }

          resendMessageId = resendResponse.data?.id || null;
          emailSendSuccess = true;

        } catch (err: any) {
          console.error("Falha ao enviar reenvio de confirmação via Resend API direta:", err.message);
        }
      }
    }

    // 3. Log de Auditoria Seguro
    console.log(JSON.stringify({
      eventType: "resend_verification",
      provider: "resend_direct",
      recipientMasked,
      success: emailSendSuccess,
      messageId: resendMessageId,
      errorCode: emailSendSuccess ? null : (linkError ? "SUPABASE_LINK_GENERATION_FAILED" : "RESEND_SEND_FAILED"),
      timestamp: new Date().toISOString()
    }));

    // 4. Respostas Seguras
    if (!user) {
      // Se for fluxo público, sempre responder sucesso genérico (evita enumeração)
      return NextResponse.json({ 
        success: true, 
        message: "Se o e-mail estiver cadastrado e ainda não verificado, enviamos as instruções." 
      });
    }

    // Se for usuário autenticado
    if (!emailSendSuccess) {
      return NextResponse.json({ 
        error: "Não conseguimos enviar o e-mail de confirmação agora. Tente novamente em alguns minutos." 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Link de confirmação enviado com sucesso!" 
    });

  } catch (err) {
    console.error("Erro na rota de reenvio de verificação:", err);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
