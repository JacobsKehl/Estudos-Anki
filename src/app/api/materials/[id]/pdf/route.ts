import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getMockUserId();

  try {
    const material = await prisma.studyMaterial.findFirst({
      where: { id, userId }
    });

    if (!material || !material.sourcePath) {
      return new NextResponse("Material não encontrado", { status: 404 });
    }

    if (!fs.existsSync(material.sourcePath)) {
      return new NextResponse("Arquivo não encontrado no servidor", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(material.sourcePath);
    const fileName = material.originalFileName || material.fileName || "document.pdf";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    console.error("[PDF API] Erro ao servir arquivo:", error);
    return new NextResponse("Erro interno ao carregar PDF", { status: 500 });
  }
}
