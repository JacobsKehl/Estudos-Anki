import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export async function GET() {
  const inboxDir = process.env.PDF_INBOX_DIR;

  if (!inboxDir) {
    return NextResponse.json({ 
      inboxDir: "Modo Nuvem (Local não configurado)",
      files: [] 
    });
  }

  try {
    // Garantir que o diretório existe (apenas se configurado)
    if (!fs.existsSync(inboxDir)) {
      return NextResponse.json({ 
        inboxDir: "Pasta local não encontrada",
        files: [] 
      });
    }

    const files = fs.readdirSync(inboxDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith(".pdf"));

    // Buscar materiais já importados da inbox
    const importedMaterials = await prisma.studyMaterial.findMany({
      where: { sourceType: "LOCAL_INBOX" },
      select: { 
        id: true,
        sourcePath: true, 
        fileHash: true, 
        fileName: true, 
        organizationStatus: true,
        subject: { select: { name: true } }
      }
    });

    const results = pdfFiles.map(fileName => {
      const fullPath = path.join(inboxDir, fileName);
      const stats = fs.statSync(fullPath);
      
      const alreadyImported = importedMaterials.find(m => m.sourcePath === fullPath);

      return {
        fileName,
        fullPath,
        size: stats.size,
        modifiedAt: stats.mtime,
        status: alreadyImported ? alreadyImported.organizationStatus : "NEW",
        isImported: !!alreadyImported,
        materialId: alreadyImported ? (alreadyImported as any).id : null,
        subjectName: alreadyImported ? (alreadyImported as any).subject?.name : null
      };
    });

    return NextResponse.json({ 
      inboxDir,
      files: results 
    });

  } catch (error: any) {
    console.error("Erro ao ler inbox:", error);
    return NextResponse.json({ error: "Erro ao processar pasta de entrada", details: error.message }, { status: 500 });
  }
}
