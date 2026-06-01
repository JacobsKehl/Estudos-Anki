import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp, rateLimitErrorResponse } from "@/lib/rate-limit";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email;

    if (!email) {
      return NextResponse.json({ error: "E-mail é obrigatório" }, { status: 400 });
    }

    const emailKey = email.toLowerCase().trim();

    // Rate Limiting: 3 tentativas por 15 minutos por IP + e-mail normalizado
    const ip = getClientIp(request);
    const rateLimitKey = `forgot-password:${ip}:${emailKey}`;
    const rateCheck = await checkRateLimit(rateLimitKey, 3, 900);
    if (!rateCheck.success) {
      return rateLimitErrorResponse(rateCheck.reset);
    }

    // Safe recipient masking for logs
    const recipientMasked = emailKey.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, domain: string) => {
      return first + "*".repeat(Math.min(middle.length, 10)) + domain;
    });

    const { isConfigured } = getSupabaseConfig();
    
    // Capturar a origem da requisição para redirecionar de volta após login no Supabase
    let appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    if (process.env.NODE_ENV === "production" || request.nextUrl.origin.includes("kehlstudy.com")) {
      appUrl = "https://kehlstudy.com";
    }
    const redirectTo = `${appUrl}/auth/callback?next=/reset-password`;

    if (!isConfigured) {
      // DEV MODE: Simulação local
      const mockCallbackUrl = `${redirectTo}&code=mock-recovery-code-for-${emailKey}`;
      console.info(`\n=== [SIMULAÇÃO RECUPERAÇÃO DE SENHA] ===`);
      console.info(`Destinatário: ${emailKey}`);
      console.info(`Link de Redefinição: ${mockCallbackUrl}`);
      console.info(`========================================\n`);

      return NextResponse.json({ 
        success: true, 
        message: "Se houver uma conta com este e-mail, enviaremos as instruções de recuperação." 
      });
    }

    // FLUXO REAL: Supabase Admin generateLink (type: 'recovery') + Resend API Direta (Bypass SMTP)
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.error("[FORGOT PASSWORD ERROR] SUPABASE_SERVICE_ROLE_KEY está ausente no ambiente.");
      return NextResponse.json(
        { error: "Erro na configuração administrativa. Tente novamente mais tarde." },
        { status: 500 }
      );
    }

    let resendMessageId: string | null = null;
    let emailSendSuccess = false;

    // Gerar o link seguro de redefinição via admin
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: emailKey,
      options: {
        redirectTo
      }
    });

    if (linkError) {
      // Registrar internamente mas silenciar para evitar enumeração de contas
      console.warn(`[Forgot Password] Falha ao gerar link seguro no Supabase (esperado se não cadastrado):`, linkError.message);
    } else {
      let actionLink = linkData.properties?.action_link || "";
      if (actionLink && actionLink.includes("localhost:3000")) {
        actionLink = actionLink.replace("http://localhost:3000", appUrl);
      } else if (actionLink && actionLink.includes("127.0.0.1:3000")) {
        actionLink = actionLink.replace("http://127.0.0.1:3000", appUrl);
      }

      // Disparar o e-mail via Resend API direta
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
  <title>Recupere sua senha - Kehl Study</title>
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
        <p>Recebemos uma solicitação de redefinição de senha para a sua conta do Kehl Study. Para criar uma nova senha de acesso, clique no botão abaixo:</p>
        <div class="cta-container">
          <a href="${actionLink}" class="btn" style="color: #ffffff;">Redefinir Minha Senha</a>
        </div>
        <p>Se você não solicitou esta redefinição, por favor ignore este e-mail com segurança. Sua senha atual permanecerá inalterada.</p>
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
            subject: "🎓 Recuperação de senha - Kehl Study",
            html: emailHtml
          });

          if (resendResponse.error) {
            throw new Error(resendResponse.error.message);
          }

          resendMessageId = resendResponse.data?.id || null;
          emailSendSuccess = true;

        } catch (err: any) {
          console.error("Falha ao enviar e-mail de recuperação via Resend API direta:", err.message);
        }
      }
    }

    // Registrar o log de auditoria de forma estruturada e segura
    console.log(JSON.stringify({
      eventType: "reset_password",
      provider: "resend_direct",
      recipientMasked,
      success: emailSendSuccess,
      messageId: resendMessageId,
      errorCode: emailSendSuccess ? null : (linkError ? "SUPABASE_LINK_GENERATION_FAILED" : "RESEND_SEND_FAILED"),
      timestamp: new Date().toISOString()
    }));

    // Retornar SEMPRE sucesso genérico para o cliente (evitando enumeração)
    return NextResponse.json({ 
      success: true, 
      message: "Se houver uma conta com este e-mail, enviaremos as instruções de recuperação." 
    });

  } catch (err) {
    console.error("Erro na rota de recuperação de senha:", err);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
