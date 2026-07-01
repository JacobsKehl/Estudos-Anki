import { NextRequest, NextResponse } from "next/server";
import { getMockUserId } from "@/lib/auth-mock";
import { backfillQuestionReviews } from "@/lib/services/question-review";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    
    // Verificar se o usuário é administrador por segurança
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    const userEmail = user?.email || "";
    const isAdmin = userEmail === process.env.ADMIN_EMAIL ||
                    (process.env.NODE_ENV === "development" && process.env.SHOW_ADMIN_TOOLS_IN_DEV === "true");

    if (!isAdmin) {
      return NextResponse.json({ error: "Acesso administrativo não autorizado" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const apply = !!body.apply;

    // Executa a carga inteligente com dry-run (apply: false) ou real (apply: true)
    const result = await backfillQuestionReviews(userId, { apply });

    return NextResponse.json({
      message: apply 
        ? "Carga real de backfill executada com sucesso no banco de dados." 
        : "Preview gerado com sucesso em modo dry-run (sem alterações).",
      result
    });
  } catch (error: any) {
    console.error("[QUESTION REVIEWS BACKFILL POST]", error);
    return NextResponse.json(
      { error: "Erro ao executar processo de backfill", details: error.message },
      { status: 500 }
    );
  }
}
