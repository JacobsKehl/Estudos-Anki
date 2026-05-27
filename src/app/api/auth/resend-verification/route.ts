import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, createSupabaseClient, getSupabaseConfig } from "@/lib/supabase-server";
import { checkRateLimit, getClientIp, rateLimitErrorResponse } from "@/lib/rate-limit";

// Cooldown em memória para simulação em desenvolvimento (mapa de email -> timestamp)
const localCooldownMap = new Map<string, number>();

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
        // Ignora corpo ausente
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

    const { isConfigured } = getSupabaseConfig();

    if (!isConfigured) {
      // DEV MODE SIMULAÇÃO
      const tokenLink = `http://localhost:3000/auth/callback?code=mock-confirmation-code-for-${emailKey}`;
      console.info(`\n=== [SIMULAÇÃO EMAIL CONFIRMAÇÃO] ===`);
      console.info(`Destinatário: ${emailKey}`);
      console.info(`Link de Confirmação: ${tokenLink}`);
      console.info(`=====================================\n`);

      return NextResponse.json({ 
        success: true, 
        message: "Se houver uma conta com este e-mail, enviamos o link de confirmação." 
      });
    }

    // FLUXO REAL: Supabase Auth
    const client = createSupabaseClient();
    
    // Disparar o reenvio de confirmação de cadastro (type: 'signup')
    const { error } = await client.auth.resend({
      type: "signup",
      email: emailKey
    });

    // Se for fluxo público (sem usuário logado), SEMPRE retornar sucesso genérico 
    // para evitar enumeração de e-mails, mesmo que ocorra erro.
    if (!user) {
      if (error) {
        console.warn(`[Public Resend] Erro silenciado para evitar enumeração de contas:`, error.message);
      }
      return NextResponse.json({ 
        success: true, 
        message: "Se o e-mail estiver cadastrado e ainda não verificado, enviamos as instruções." 
      });
    }

    // Se for usuário logado, expõe erro de rate limit de forma limpa
    if (error) {
      console.error("Erro no reenvio Supabase:", error);
      if (error.status === 429) {
        return NextResponse.json({ 
          error: "Limite de envio excedido. Tente novamente em alguns minutos." 
        }, { status: 429 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
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
