import { prisma } from "./prisma";
import { getSessionUser, syncSupabaseUserWithPrismaUser, getSupabaseConfig } from "./supabase-server";

/**
 * Retorna o ID do usuário atualmente autenticado.
 * Em desenvolvimento local, se permitido ou se o Supabase não estiver configurado, 
 * fornece o fallback para o usuário mock.
 */
export async function getMockUserId(): Promise<string> {
  // 1. Tentar obter o usuário autenticado real da sessão
  const sessionUser = await getSessionUser();
  if (sessionUser) {
    const internalUser = await syncSupabaseUserWithPrismaUser(sessionUser);
    return internalUser.id;
  }

  // 2. Fallback para simulação local se em desenvolvimento e se explicitamente habilitado ou Supabase inativo
  const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  const allowMock = process.env.ALLOW_MOCK_USER === "true";
  const { isConfigured } = getSupabaseConfig();

  if (isDev && (allowMock || !isConfigured)) {
    let user = await prisma.user.findFirst();
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "Gabriela Furtado",
          email: "dev@kehl.study",
          studyFocus: "Estudando para TRT4"
        }
      });
    }
    
    return user.id;
  }

  throw new Error("Acesso não autorizado: Sessão não encontrada ou expirada.");
}
