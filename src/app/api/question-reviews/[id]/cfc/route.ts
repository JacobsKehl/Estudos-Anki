import { NextRequest, NextResponse } from "next/server";
import { getMockUserId } from "@/lib/auth-mock";
import { updateCfcMapping } from "@/lib/services/question-review";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getMockUserId();
    const body = await req.json().catch(() => ({}));
    
    const { cfcPdfName, cfcStartPage, cfcEndPage, cfcTopic, cfcNotes } = body;

    const task = await updateCfcMapping(userId, id, {
      cfcPdfName,
      cfcStartPage: cfcStartPage !== undefined ? Number(cfcStartPage) : undefined,
      cfcEndPage: cfcEndPage !== undefined ? Number(cfcEndPage) : undefined,
      cfcTopic,
      cfcNotes
    });

    return NextResponse.json(task);
  } catch (error: any) {
    console.error("[QUESTION REVIEWS CFC PATCH]", error);
    if (error.message.includes("não encontrada")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar mapeamento CFC", details: error.message },
      { status: 500 }
    );
  }
}
