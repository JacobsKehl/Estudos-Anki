import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reorganizeActiveSchedule } from "@/lib/scheduler";
import { getMockUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    
    // Perform schedule reorganization
    const result = await reorganizeActiveSchedule(userId, 30);

    if (!result) {
      return NextResponse.json({
        error: "Nenhum cronograma ativo ou matérias encontradas para reorganizar."
      }, { status: 404 });
    }

    return NextResponse.json({
      message: "Cronograma reorganizado com sucesso.",
      itemsCount: result.itemsCount
    });
  } catch (error: any) {
    console.error("[SCHEDULE REORGANIZE]", error);
    return NextResponse.json(
      { error: "Falha ao reorganizar cronograma.", details: error.message },
      { status: 500 }
    );
  }
}
