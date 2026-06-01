import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type, email, name } = body;

    if (!email) {
      return NextResponse.json({ error: "E-mail de destino é obrigatório." }, { status: 400 });
    }

    const emailKey = email.toLowerCase().trim();

    // 1. Validar Autorização (Sessão Admin OU Token Secreto)
    let isAuthorized = false;

    // A. Verificar Token Secreto no Header Authorization
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const adminSecret = process.env.ADMIN_SECRET || process.env.INVITE_SECRET;
      
      if (adminSecret && token === adminSecret) {
        isAuthorized = true;
      }
    }

    // B. Verificar Sessão do Usuário Logado
    if (!isAuthorized) {
      const sessionUser = await getSessionUser();
      const adminEmail = process.env.ADMIN_EMAIL || "dev@kehl.study";

      if (sessionUser && sessionUser.email === adminEmail) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }

    // Safe recipient masking for logs
    const recipientMasked = emailKey.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, domain: string) => {
      return first + "*".repeat(Math.min(middle.length, 10)) + domain;
    });

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      throw new Error("createSupabaseAdminClient retornou nulo. Verifique a chave SUPABASE_SERVICE_ROLE_KEY no ambiente.");
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY está ausente no ambiente.");
    }

    const resend = new Resend(resendApiKey);
    const emailFrom = process.env.EMAIL_FROM || "Kehl Study <noreply@kehlstudy.com>";
    
    let appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    if (process.env.NODE_ENV === "production" || request.nextUrl.origin.includes("kehlstudy.com")) {
      appUrl = "https://kehlstudy.com";
    }

    let result: any = { success: false };

    // 2. Processar de acordo com o tipo de teste solicitado (Bypassing SMTP do Supabase)
    if (type === "daily_reminder") {
      // Buscar o usuário correspondente no banco para carregar matérias/srs reais
      const targetUser = await prisma.user.findFirst({
        where: { email: emailKey },
        include: { preferences: true }
      });

      if (!targetUser) {
        return NextResponse.json({
          error: `Usuário com o e-mail ${emailKey} não foi encontrado no banco de dados. Cadastre o usuário ou crie o perfil antes de disparar o lembrete diário.`
        }, { status: 404 });
      }

      // Disparar o envio real do lembrete chamando a rota do cron com o bypass manual e o ID do usuário específico
      const manualKey = process.env.MANUAL_TRIGGER_KEY || "kehl2025manual";
      const response = await fetch(`${appUrl}/api/cron/reminder?userId=${targetUser.id}&manual_key=${manualKey}`, {
        headers: {
          "Cache-Control": "no-cache"
        }
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Falha ao acionar a rota do lembrete diário.");
      }

      const specificResult = data.results?.find((r: any) => r.userId === targetUser.id);
      
      result = {
        success: true,
        provider: "resend_direct",
        messageId: specificResult?.messageId || "cron-resend-direct-triggered",
        message: `Lembrete diário enviado com sucesso via Resend para ${emailKey}!`
      };

    } else if (type === "signup_confirmation" || type === "resend_verification") {
      const redirectTo = `${appUrl}/auth/callback`;

      // Gerar o link administrativo
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "signup",
        email: emailKey,
        password: "", // String vazia para satisfazer tipagem estática GenerateSignupLinkParams
        options: {
          redirectTo
        }
      });

      if (linkError) {
        throw new Error(`Erro ao gerar link de ativação no Supabase Admin: ${linkError.message}`);
      }

      let actionLink = linkData.properties?.action_link || "";
      if (actionLink && actionLink.includes("localhost:3000")) {
        actionLink = actionLink.replace("http://localhost:3000", appUrl);
      } else if (actionLink && actionLink.includes("127.0.0.1:3000")) {
        actionLink = actionLink.replace("http://127.0.0.1:3000", appUrl);
      }

      // Disparar via Resend direto
      const resendResponse = await resend.emails.send({
        from: emailFrom,
        to: emailKey,
        subject: "🎓 [Teste] Ative sua conta no Kehl Study",
        html: `<p>Olá! Este é um e-mail de teste de ativação de conta. Clique no link abaixo para ativar:</p><p><a href="${actionLink}">Ativar Minha Conta</a></p>`
      });

      if (resendResponse.error) {
        throw new Error(`Falha no envio do Resend: ${resendResponse.error.message}`);
      }

      result = {
        success: true,
        provider: "resend_direct",
        messageId: resendResponse.data?.id || null,
        message: `E-mail de confirmação de cadastro enviado com sucesso para ${emailKey}!`
      };

    } else if (type === "invite") {
      const redirectTo = `${appUrl}/auth/callback`;

      // Gerar link de convite administrativo
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email: emailKey,
        options: {
          redirectTo,
          data: name ? { full_name: name } : undefined
        }
      });

      if (linkError) {
        throw new Error(`Erro ao gerar link de convite no Supabase Admin: ${linkError.message}`);
      }

      let actionLink = linkData.properties?.action_link || "";
      if (actionLink && actionLink.includes("localhost:3000")) {
        actionLink = actionLink.replace("http://localhost:3000", appUrl);
      } else if (actionLink && actionLink.includes("127.0.0.1:3000")) {
        actionLink = actionLink.replace("http://127.0.0.1:3000", appUrl);
      }

      // Enviar e-mail de convite via Resend direto
      const resendResponse = await resend.emails.send({
        from: emailFrom,
        to: emailKey,
        subject: "🎓 [Teste] Convite Especial Kehl Study",
        html: `<p>Olá! Você foi convidado para o Kehl Study. Aceite clicando no link:</p><p><a href="${actionLink}">Aceitar Convite</a></p>`
      });

      if (resendResponse.error) {
        throw new Error(`Falha no envio do Resend: ${resendResponse.error.message}`);
      }

      result = {
        success: true,
        provider: "resend_direct",
        messageId: resendResponse.data?.id || null,
        message: `E-mail de convite enviado com sucesso para ${emailKey}!`
      };

    } else if (type === "reset_password") {
      const redirectTo = `${appUrl}/auth/callback?next=/reset-password`;

      // Gerar link de redefinição de senha seguro
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: emailKey,
        options: {
          redirectTo
        }
      });

      if (linkError) {
        throw new Error(`Erro ao gerar link de redefinição no Supabase Admin: ${linkError.message}`);
      }

      let actionLink = linkData.properties?.action_link || "";
      if (actionLink && actionLink.includes("localhost:3000")) {
        actionLink = actionLink.replace("http://localhost:3000", appUrl);
      } else if (actionLink && actionLink.includes("127.0.0.1:3000")) {
        actionLink = actionLink.replace("http://127.0.0.1:3000", appUrl);
      }

      // Enviar e-mail de recuperação de senha via Resend direto
      const resendResponse = await resend.emails.send({
        from: emailFrom,
        to: emailKey,
        subject: "🎓 [Teste] Recuperação de senha - Kehl Study",
        html: `<p>Olá! Redefina sua senha clicando no link abaixo:</p><p><a href="${actionLink}">Redefinir Senha</a></p>`
      });

      if (resendResponse.error) {
        throw new Error(`Falha no envio do Resend: ${resendResponse.error.message}`);
      }

      result = {
        success: true,
        provider: "resend_direct",
        messageId: resendResponse.data?.id || null,
        message: `E-mail de recuperação de senha enviado com sucesso para ${emailKey}!`
      };

    } else {
      return NextResponse.json({ error: "Tipo de teste inválido. Use 'daily_reminder', 'signup_confirmation', 'invite' ou 'reset_password'." }, { status: 400 });
    }

    // Log estruturado e seguro no console (Bypass SMTP e tokens)
    console.log(JSON.stringify({
      eventType: `test_${type}`,
      provider: result.provider,
      recipientMasked,
      userId: null,
      success: true,
      messageId: result.messageId,
      errorCode: null,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json(result);

  } catch (err: any) {
    const body = await request.clone().json().catch(() => ({}));
    const recipientMasked = (body.email || "").replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, domain: string) => {
      return first + "*".repeat(Math.min(middle.length, 10)) + domain;
    });

    console.log(JSON.stringify({
      eventType: `test_${body.type || "unknown"}_error`,
      provider: "resend_direct",
      recipientMasked,
      userId: null,
      success: false,
      messageId: null,
      errorCode: err.message || "TEST_FAILED",
      timestamp: new Date().toISOString()
    }));

    console.error("Erro crítico na rota de teste administrativo de e-mail:", err);
    return NextResponse.json({ success: false, error: err.message || "Erro crítico ao disparar e-mail de teste." }, { status: 500 });
  }
}
