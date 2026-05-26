import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  const isConfigured = !!(supabaseUrl && supabaseAnonKey);
  
  return {
    supabaseUrl: supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey: supabaseAnonKey || "placeholder",
    isConfigured
  };
}

export function createSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

/**
 * Obtém o usuário da sessão a partir do cookie 'sb-access-token'
 */
export async function getSessionUser() {
  try {
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured) {
      return null;
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;
    
    if (!accessToken) return null;
    
    const client = createSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser(accessToken);
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (err) {
    console.error("Erro ao obter usuário da sessão:", err);
    return null;
  }
}

/**
 * Define os cookies HttpOnly da sessão na resposta
 */
export function setSessionCookies(
  response: NextResponse, 
  accessToken: string, 
  refreshToken: string, 
  expiresIn: number
) {
  const isProd = process.env.NODE_ENV === "production";
  
  response.cookies.set("sb-access-token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  });
  
  response.cookies.set("sb-refresh-token", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 dias de duração máxima
  });
}

/**
 * Remove os cookies da sessão na resposta de logout
 */
export function clearSessionCookies(response: NextResponse) {
  response.cookies.set("sb-access-token", "", {
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("sb-refresh-token", "", {
    path: "/",
    maxAge: 0,
  });
}

/**
 * Sincroniza um usuário do Supabase com o banco local Prisma,
 * garantindo o vínculo com o usuário atual do banco e evitando duplicidade.
 */
export async function syncSupabaseUserWithPrismaUser(supabaseUser: { id: string; email?: string; user_metadata?: any }) {
  const authUserId = supabaseUser.id;
  const email = supabaseUser.email?.toLowerCase().trim();

  // 1. Procurar User por authUserId
  let user = await prisma.user.findUnique({
    where: { authUserId }
  });

  if (user) {
    // Atualizar lastLoginAt e email se necessário
    const updateData: any = { lastLoginAt: new Date() };
    if (email && user.email !== email) {
      updateData.email = email;
    }
    user = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });
  } else {
    // 2. Procurar User por e-mail se disponível
    if (email) {
      user = await prisma.user.findUnique({
        where: { email }
      });

      if (user) {
        // Vincula a conta existente ao ID de autenticação do Supabase
        const oldAuthUserId = user.authUserId;
        user = await prisma.user.update({
          where: { id: user.id },
          data: { 
            authUserId,
            lastLoginAt: new Date()
          }
        });
        
        if (oldAuthUserId && oldAuthUserId !== authUserId) {
          console.warn(`[SECURITY AUDIT] authUserId do usuário ${user.id} (${email}) alterado de ${oldAuthUserId} para ${authUserId}.`);
        }
        console.info(`[MIGRATION] Usuário existente localizado por e-mail (${email}) e vinculado ao authUserId: ${authUserId}`);
      }
    }

    // 3. Se ainda não achou, checar se existe exatamente 1 usuário no banco (legado/mock)
    if (!user) {
      const existingUsers = await prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        take: 2
      });

      if (existingUsers.length === 1) {
        const legacyUser = existingUsers[0];
        user = await prisma.user.update({
          where: { id: legacyUser.id },
          data: {
            authUserId,
            email: email || legacyUser.email,
            name: legacyUser.name || "Gabriela Furtado",
            lastLoginAt: new Date()
          }
        });
        console.info(`[MIGRATION] Usuário legado/mock ${legacyUser.id} (${legacyUser.email}) vinculado ao Supabase authUserId: ${authUserId}, email: ${email}`);
      }
    }

    // 4. Se realmente não houver usuário, criar um novo
    if (!user) {
      user = await prisma.user.create({
        data: {
          authUserId,
          email,
          name: supabaseUser.user_metadata?.full_name || email?.split("@")[0] || "Estudante",
          lastLoginAt: new Date(),
          studyFocus: "Geral"
        }
      });
      console.info(`[REGISTRATION] Novo usuário criado no Prisma para authUserId: ${authUserId}, email: ${email}`);
    }
  }

  // 5. Garantir que as preferências do usuário existam sem sobrescrever as preenchidas
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId: user.id }
  });

  if (!prefs) {
    await prisma.userPreferences.create({
      data: {
        userId: user.id,
        displayName: user.name || "Estudante",
        focusArea: user.studyFocus || "Geral",
        examGoal: "TRT4",
        deadline: new Date("2026-11-30T23:59:59"),
        dailyGoalMinutes: 120,
        studyResetTime: "00:00",
        studyDaysOfWeek: "1,2,3,4,5,6,0"
      }
    });
    console.info(`[PREFERENCES] UserPreferences iniciais criadas para o usuário: ${user.id}`);
  }

  return user;
}
