import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
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

    const isLocal = material.sourceType === "LOCAL_INBOX";
    let fileBuffer: Buffer | Uint8Array;

    if (isLocal) {
      if (!fs.existsSync(material.sourcePath)) {
        return new NextResponse("Arquivo não encontrado no servidor", { status: 404 });
      }
      fileBuffer = fs.readFileSync(material.sourcePath);
    } else {
      // Download from Supabase Storage
      const { data, error } = await supabase.storage.from('materials').download(material.sourcePath);
      if (error) {
        console.error("Erro ao baixar do Storage:", error);
        return new NextResponse("Erro ao carregar arquivo da nuvem", { status: 500 });
      }
      const arrayBuffer = await data.arrayBuffer();
      fileBuffer = new Uint8Array(arrayBuffer);
    }

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
