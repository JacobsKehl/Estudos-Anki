/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const inboxDir = process.env.PDF_INBOX_DIR;
  
  if (!inboxDir) {
    return NextResponse.json({ error: "PDF_INBOX_DIR não configurado" }, { status: 500 });
  }

  try {
    const { files } = await req.json();

    if (!files || !Array.isArray(files)) {
      return NextResponse.json({ error: "Lista de arquivos inválida" }, { status: 400 });
    }

    // Buscar o primeiro usuário (em dev usamos o que estiver lá)
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { name: "Usuário Dev", email: "dev@kehl.study" }
      });
    }
    const userId = user.id;

    const results = [];

    for (const fileData of files) {
      const { fullPath, fileName } = fileData;

      try {
        // Validação de Segurança: O arquivo deve estar dentro da inboxDir
        const resolvedPath = path.resolve(fullPath);
        const resolvedInboxDir = path.resolve(inboxDir);
        
        if (!resolvedPath.startsWith(resolvedInboxDir)) {
          results.push({ fileName, status: "ERROR", error: "Acesso negado: arquivo fora da pasta autorizada" });
          continue;
        }

        if (!fs.existsSync(fullPath)) {
          results.push({ fileName, status: "ERROR", error: "Arquivo não encontrado fisicamente" });
          continue;
        }

        if (!fileName.toLowerCase().endsWith(".pdf")) {
          results.push({ fileName, status: "ERROR", error: "Apenas arquivos PDF são permitidos" });
          continue;
        }

        const stats = fs.statSync(fullPath);
        
        // Calcular hash rápido (apenas metadados + início do arquivo para performance, ou todo se pequeno)
        // Por simplicidade e robustez pedida, vamos usar o hash do conteúdo
        const fileBuffer = fs.readFileSync(fullPath);
        const fileHash = crypto.createHash("md5").update(fileBuffer).digest("hex");

        // Verificar duplicidade
        const existing = await prisma.studyMaterial.findFirst({
          where: { 
            OR: [
              { sourcePath: fullPath },
              { fileHash: fileHash }
            ],
            userId 
          }
        });

        if (existing) {
          results.push({ fileName, status: "ALREADY_IMPORTED", id: existing.id });
          continue;
        }

        // Criar o material (Passo 1: Importação)
        const material = await prisma.studyMaterial.create({
          data: {
            userId,
            subjectId: null, // Matéria será identificada no Passo 2 (Organizar)
            fileName,
            originalFileName: fileName,
            sourceType: "LOCAL_INBOX",
            sourcePath: fullPath,
            fileHash: fileHash,
            fileSize: stats.size,
            organizationStatus: "IMPORTED", 
            processingStatus: "PENDING"
          }
        });

        results.push({ 
          fileName, 
          status: "SUCCESS", 
          id: material.id
        });

        console.log(`[IMPORT] Sucesso: ${fileName}`);

      } catch (error: any) {
        console.error(`[IMPORT ERROR] ${fileName}:`, error);
        results.push({ fileName, status: "ERROR", error: error.message });
      }
    }

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error("[API ERROR] /api/inbox/import:", error);
    return NextResponse.json({ error: "Erro interno na API de importação", details: error.message }, { status: 500 });
  }
}
