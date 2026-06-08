import { prisma } from "./prisma";
import { getSessionUser, syncSupabaseUserWithPrismaUser } from "./supabase-server";

/**
 * Retorna o ID do usuário atualmente autenticado de forma segura.
 * Chaveia entre o Supabase Auth real e a simulação de desenvolvimento local
 * dependendo da configuração de AUTH_MODE e do ambiente atual.
 */
export async function getCurrentUserId(): Promise<string> {
  const isProd = process.env.NODE_ENV === "production";

  // Allow test override in development/test environments
  if (process.env.TEST_USER_ID && !isProd) {
    return process.env.TEST_USER_ID;
  }

  const authMode = process.env.AUTH_MODE || "SUPABASE";

  // Em produção, AUTH_MODE=MOCK é expressamente proibido e seguro.
  if (isProd && authMode === "MOCK") {
    throw new Error("Erro de Segurança Crítico: AUTH_MODE=MOCK não é permitido em produção.");
  }

  // Se o modo for Supabase (padrão em produção e recomendado),
  // tentamos obter o ID real da sessão do Supabase.
  if (authMode === "SUPABASE" || isProd) {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      const internalUser = await syncSupabaseUserWithPrismaUser(sessionUser);
      return internalUser.id;
    }
    throw new Error("Acesso não autorizado: Sessão não encontrada ou expirada no Supabase.");
  }

  // Fallback controlado para simulação local com AUTH_MODE=MOCK em desenvolvimento/teste
  if (authMode === "MOCK") {
    let user = await prisma.user.findFirst();
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "Estudante",
          email: "dev@kehl.study",
          preferences: {
            create: {
              displayName: "Estudante",
              examGoal: "Estudos",
              focusArea: "Geral",
              languageTone: "MASCULINE_NEUTRAL",
            }
          }
        }
      });
    }
    
    return user.id;
  }

  throw new Error("Configuração de AUTH_MODE inválida ou sessão expirada.");
}

/**
 * Helper legível e compatível temporariamente para as rotas que ainda usam getMockUserId.
 * @deprecated Use getCurrentUserId() em vez disso.
 */
export async function getMockUserId(): Promise<string> {
  return getCurrentUserId();
}
