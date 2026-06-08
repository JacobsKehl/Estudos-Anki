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
    let response = NextResponse.redirect(new URL(next, origin));

    // A. Se os tokens foram passados diretamente via query params (vindo da captura do hash pelo cliente)
    if (accessToken && refreshToken) {
      const expiresIn = expiresInStr ? parseInt(expiresInStr, 10) : 3600;
      
      // Criar a resposta de redirecionamento.
      // Se for para reset-password, passar tokens na URL como backup client-side
      let redirectUrl = new URL(next, origin);
      if (next.startsWith("/reset-password")) {
        redirectUrl.searchParams.set("access_token", accessToken);
        redirectUrl.searchParams.set("refresh_token", refreshToken);
      }
      response = NextResponse.redirect(redirectUrl);
      setSessionCookies(response, accessToken, refreshToken, expiresIn);
      
      // Sincronizar o usuário no Prisma decodificando o JWT de forma offline e segura (à prova de falhas)
      try {
        const payloadPart = accessToken.split(".")[1];
        if (payloadPart) {
          const payloadJson = Buffer.from(payloadPart, "base64").toString("utf-8");
          const payload = JSON.parse(payloadJson);
          const email = payload.email;
          const authUserId = payload.sub;
          const fullName = payload.user_metadata?.full_name || payload.name;

          if (authUserId && email) {
            const existing = await prisma.user.findFirst({
              where: { 
                OR: [
                  { authUserId },
                  { email: email.toLowerCase().trim() }
                ]
              }
            });

            if (!existing) {
              const newUser = await prisma.user.create({
                data: {
                  authUserId,
                  email: email.toLowerCase().trim(),
                  name: fullName || email.split("@")[0] || "Estudante",
                  lastLoginAt: new Date()
                }
              });

              await prisma.userPreferences.create({
                data: {
                  userId: newUser.id,
                  displayName: fullName || email.split("@")[0] || "Estudante",
                  languageTone: "MASCULINE_NEUTRAL",
                  examGoal: "Estudos",
                  focusArea: "Geral",
                  dailyGoalMinutes: 120,
                  emailReminderEnabled: false,
                  theme: "light",
                  visualDensity: "comfortable",
                  flashcardDifficulty: "NORMAL",
                  studyDaysOfWeek: "0,1,2,3,4,5,6",
                  scheduleGenerationMode: "DYNAMIC"
                }
              });
            } else {
              // Atualiza o vínculo do authUserId e o último login
              await prisma.user.update({
                where: { id: existing.id },
                data: { 
                  authUserId,
                  lastLoginAt: new Date()
                }
              });
            }
          }
        }
      } catch (syncErr) {
        console.error("Erro ao sincronizar de forma offline o usuário no callback:", syncErr);
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

    // Criar a resposta de redirecionamento.
    let redirectUrl = new URL(next, origin);
    if (next.startsWith("/reset-password")) {
      redirectUrl.searchParams.set("access_token", session.access_token);
      redirectUrl.searchParams.set("refresh_token", session.refresh_token);
    }
    response = NextResponse.redirect(redirectUrl);

    // Salvar cookies na resposta e redirecionar
    setSessionCookies(response, session.access_token, session.refresh_token, session.expires_in);
    return response;

  } catch (err) {
    console.error("Erro interno no callback de autenticação:", err);
    return NextResponse.redirect(new URL("/login?error=Erro interno no servidor", request.url));
  }
}
