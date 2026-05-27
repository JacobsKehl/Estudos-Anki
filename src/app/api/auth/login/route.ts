import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseConfig, createSupabaseClient, setSessionCookies, syncSupabaseUserWithPrismaUser } from "@/lib/supabase-server";
import { checkRateLimit, getClientIp, rateLimitErrorResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || "").toLowerCase().trim();
    const password = body.password;
    const rememberMe = body.rememberMe;

    if (!email || !password) {
      return NextResponse.json({ error: "E-mail e senha são obrigatórios" }, { status: 400 });
    }

    // Rate Limiting: 5 tentativas por 10 minutos por IP + e-mail normalizado
    const ip = getClientIp(request);
    const rateLimitKey = `login:${ip}:${email}`;
    const rateCheck = await checkRateLimit(rateLimitKey, 5, 600);
    if (!rateCheck.success) {
      return rateLimitErrorResponse(rateCheck.reset);
    }

    const { isConfigured } = getSupabaseConfig();

    // ─── CENÁRIO 1: Supabase não configurado (Simulação local de Dev) ───────────
    if (!isConfigured) {
      console.info(`[MOCK LOGIN] Simulação de login para: ${email} (Lembrar: ${!!rememberMe})`);
      
      const mockSupabaseUser = {
        id: `mock-auth-${email.split("@")[0]}`,
        email: email.toLowerCase().trim(),
        user_metadata: { full_name: email.split("@")[0] }
      };

      // Sincronizar usando o helper centralizado
      const internalUser = await syncSupabaseUserWithPrismaUser(mockSupabaseUser);

      // Gerar dummy JWT com expiração de 1 hora ou 30 dias para o middleware validar
      const expSeconds = rememberMe ? 30 * 24 * 60 * 60 : 3600;
      const expTimestamp = Math.floor(Date.now() / 1000) + expSeconds;
      const payloadObj = { email, exp: expTimestamp };
      const payloadB64 = btoa(JSON.stringify(payloadObj)).replace(/=/g, "");
      const dummyToken = `dummy.${payloadB64}.dummy`;

      const response = NextResponse.json({ 
        success: true, 
        user: { id: internalUser.id, email: internalUser.email, name: internalUser.name },
        mock: true
      });
      
      setSessionCookies(response, dummyToken, "dummy-refresh-token", expSeconds, !!rememberMe);
      return response;
    }

    // ─── CENÁRIO 2: Supabase ativo e configurado ────────────────────────────────
    const client = createSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });

    if (error || !data.user || !data.session) {
      return NextResponse.json({ error: error?.message || "Credenciais inválidas" }, { status: 400 });
    }

    const supabaseUser = data.user;
    const session = data.session;

    // Sincronização segura com o Prisma usando o helper centralizado
    const internalUser = await syncSupabaseUserWithPrismaUser(supabaseUser);

    // Grava cookies HttpOnly e retorna sucesso
    const response = NextResponse.json({ 
      success: true, 
      user: { id: internalUser.id, email: internalUser.email, name: internalUser.name }
    });
    
    setSessionCookies(response, session.access_token, session.refresh_token, session.expires_in, !!rememberMe);
    return response;

  } catch (err: any) {
    console.error("Erro na rota de login:", err);
    return NextResponse.json({ error: "Erro interno no servidor de autenticação" }, { status: 500 });
  }
}
