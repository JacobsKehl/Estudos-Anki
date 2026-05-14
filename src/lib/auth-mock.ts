import { prisma } from "./prisma";

/**
 * Em modo MVP/Dev, não temos autenticação real.
 * Esta função garante que sempre haja um usuário no banco e retorna seu ID.
 */
export async function getMockUserId(): Promise<string> {
  let user = await prisma.user.findFirst();
  
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Usuário Dev",
        email: "dev@kehl.study"
      }
    });
  }
  
  return user.id;
}
