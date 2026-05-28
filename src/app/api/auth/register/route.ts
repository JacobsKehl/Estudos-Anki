import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseConfig, createSupabaseClient } from "@/lib/supabase-server";
import { checkRateLimit, getClientIp, rateLimitErrorResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // 1. Validar se ENABLE_SIGNUP está ativo no servidor
    const enableSignup = process.env.ENABLE_SIGNUP === "true";
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

    // 4. Verificar se o e-mail já existe no Prisma local
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      // Retornar resposta genérica de sucesso para evitar enumeração de e-mails
      console.info(`[REGISTRATION SECURITY] Cadastro rejeitado silenciosamente: e-mail ${email} já cadastrado no Prisma.`);
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
          examGoal: "TRT",
          focusArea: "Estudos",
          dailyGoalMinutes: 120,
          emailReminderEnabled: false,
          theme: "light",
          visualDensity: "comfortable",
          flashcardDifficulty: "NORMAL",
          studyResetTime: "00:00",
          studyDaysOfWeek: "0,1,2,3,4,5,6",
          languageTone: "MASCULINE_NEUTRAL"
        }
      });

      return NextResponse.json({
        success: true,
        message: "Cadastro recebido! Se o e-mail for novo, enviamos um link de confirmação para a sua caixa de entrada.",
        mock: true
      });
    }

    // ─── CENÁRIO 2: Supabase ativo e configurado ────────────────────────────────
    const client = createSupabaseClient();
    
    // Cadastrar no Supabase Auth
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback`,
        data: {
          full_name: name
        }
      }
    });

    if (signUpError) {
      console.error("Erro no cadastro do Supabase Auth:", signUpError.message);
      // Se for erro de usuário já existente, retornar sucesso genérico para evitar enumeração
      if (signUpError.message.toLowerCase().includes("already registered") || signUpError.status === 422) {
        return NextResponse.json({
          success: true,
          message: "Cadastro recebido! Se o e-mail for novo, enviamos um link de confirmação para a sua caixa de entrada."
        });
      }
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }

    if (!signUpData.user) {
      return NextResponse.json({ error: "Erro ao criar identidade de usuário no Supabase." }, { status: 400 });
    }

    const authUserId = signUpData.user.id;

    // Criar o registro correspondente no Prisma
    const newUser = await prisma.user.create({
      data: {
        authUserId,
        email,
        name,
        lastLoginAt: null
      }
    });

    // Criar as UserPreferences padrão
    await prisma.userPreferences.create({
      data: {
        userId: newUser.id,
        displayName: name,
        examGoal: "TRT",
        focusArea: "Estudos",
        dailyGoalMinutes: 120,
        emailReminderEnabled: false,
        theme: "light",
        visualDensity: "comfortable",
        flashcardDifficulty: "NORMAL",
        studyResetTime: "00:00",
        studyDaysOfWeek: "0,1,2,3,4,5,6",
        languageTone: "MASCULINE_NEUTRAL"
      }
    });

    console.info(`[REGISTRATION] Novo usuário criado no Prisma para authUserId: ${authUserId}, email: ${email}`);

    return NextResponse.json({
      success: true,
      message: "Cadastro recebido! Se o e-mail for novo, enviamos um link de confirmação para a sua caixa de entrada."
    });

  } catch (err: any) {
    console.error("Erro na rota de cadastro:", err);
    return NextResponse.json({ error: "Erro interno no servidor ao processar cadastro." }, { status: 500 });
  }
}
