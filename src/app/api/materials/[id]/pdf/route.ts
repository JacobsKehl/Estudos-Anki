import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { getMockUserId } from "@/lib/auth-mock";

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

    if (!material) {
      return new NextResponse("Material não encontrado", { status: 404 });
    }

    const isLocal = material.sourceType === "LOCAL_INBOX" || material.sourceType === "LOCAL_UPLOAD";
    let fileBuffer: Buffer;

    if (isLocal) {
      const fs = await import("fs");
      if (!material.sourcePath || !fs.existsSync(material.sourcePath)) {
        return new NextResponse("Arquivo local não encontrado no disco.", { status: 404 });
      }
      fileBuffer = fs.readFileSync(material.sourcePath);
    } else {
      // Download from Supabase Storage
      const { data, error } = await supabase.storage.from('materials').download(material.sourcePath!);
      if (error) {
        console.error("Erro ao baixar do Storage:", error);
        return new NextResponse("Erro ao carregar arquivo da nuvem", { status: 500 });
      }
      const arrayBuffer = await data.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    }

    const fileName = material.originalFileName || material.fileName || "document.pdf";

    return new NextResponse(fileBuffer as any, {
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
