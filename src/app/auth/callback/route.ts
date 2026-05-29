import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseConfig, createSupabaseClient, setSessionCookies, syncSupabaseUserWithPrismaUser } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    const expiresInStr = searchParams.get("expires_in");
    const next = searchParams.get("next") || "/";

    const response = NextResponse.redirect(new URL(next, origin));

    // A. Se os tokens foram passados diretamente via query params (vindo da captura do hash pelo cliente)
    if (accessToken && refreshToken) {
      const expiresIn = expiresInStr ? parseInt(expiresInStr, 10) : 3600;
      setSessionCookies(response, accessToken, refreshToken, expiresIn);
      
      // Sincronizar o usuário no Prisma para garantir que ele exista localmente
      try {
        const client = createSupabaseClient();
        const { data: { user }, error: userError } = await client.auth.getUser(accessToken);
        if (user && !userError) {
          await syncSupabaseUserWithPrismaUser(user);
        }
      } catch (syncErr) {
        console.error("Erro ao sincronizar usuário via tokens no callback:", syncErr);
      }

      return response;
    }

    if (!code) {
      return response; // Sem código, apenas redireciona para a home
    }

    const { isConfigured } = getSupabaseConfig();

    // ─── CENÁRIO 1: Simulação local em Desenvolvimento ────────────────────────
    if (!isConfigured) {
      let email = "dev@kehl.study";
      if (code.includes("-for-")) {
        email = code.split("-for-")[1];
      }

      console.info(`[MOCK CALLBACK] Processando código de dev para: ${email}`);

      const mockSupabaseUser = {
        id: `mock-auth-${email.split("@")[0]}`,
        email: email.toLowerCase().trim(),
        user_metadata: { full_name: email.split("@")[0] }
      };

      // Sincronizar usando o helper centralizado
      const internalUser = await syncSupabaseUserWithPrismaUser(mockSupabaseUser);

      // Definir cookies de simulação
      const expTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const payloadObj = { email, exp: expTimestamp };
      const payloadB64 = btoa(JSON.stringify(payloadObj)).replace(/=/g, "");
      const dummyToken = `dummy.${payloadB64}.dummy`;

      setSessionCookies(response, dummyToken, "dummy-refresh-token", 3600);
      return response;
    }

    // ─── CENÁRIO 2: Fluxo oficial Supabase Auth ──────────────────────────────
    const client = createSupabaseClient();
    const { data, error } = await client.auth.exchangeCodeForSession(code);

    if (error || !data.session || !data.user) {
      console.error("Erro ao trocar código por sessão no callback:", error);
      // Redireciona para o login informando o erro
      const errorUrl = new URL("/login", origin);
      errorUrl.searchParams.set("error", "Erro ao validar sessão. Tente novamente.");
      return NextResponse.redirect(errorUrl);
    }

    const session = data.session;
    const supabaseUser = data.user;

    // Sincronização segura no Prisma usando o helper centralizado
    await syncSupabaseUserWithPrismaUser(supabaseUser);

    // Salvar cookies na resposta e redirecionar (removendo tokens da URL automaticamente)
    setSessionCookies(response, session.access_token, session.refresh_token, session.expires_in);
    return response;

  } catch (err) {
    console.error("Erro interno no callback de autenticação:", err);
    return NextResponse.redirect(new URL("/login?error=Erro interno no servidor", request.url));
  }
}
