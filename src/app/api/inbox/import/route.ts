/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import { identifySubject } from "@/lib/ai/organizer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const crypto = require("crypto");
  const pdf = require("pdf-parse");
  const { files, userId = "cm39k012x0001k93jqwerty12" } = await req.json();

  if (!files || !Array.isArray(files)) {
    return NextResponse.json({ error: "Lista de arquivos inválida" }, { status: 400 });
  }

  const results = [];

  for (const fileData of files) {
    const { fullPath, fileName } = fileData;

    try {
      if (!fs.existsSync(fullPath)) {
        results.push({ fileName, status: "ERROR", error: "Arquivo não encontrado" });
        continue;
      }

      // Calcular hash do arquivo para evitar duplicidade de conteúdo
      const fileBuffer = fs.readFileSync(fullPath);
      const fileHash = crypto.createHash("md5").update(fileBuffer).digest("hex");

      // Verificar duplicidade por sourcePath ou fileHash
      const existing = await (prisma as any).studyMaterial.findFirst({
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

      // 1. Ler as primeiras páginas para identificação
      // Extrair apenas o início (limitar a 5 páginas para ser rápido)
      const pdfData = await pdf(fileBuffer, { max: 5 });
      const sampleText = pdfData.text.substring(0, 5000);

      // 2. Identificar matéria com IA
      const subjectName = await identifySubject(sampleText);

      // 3. Buscar ou criar matéria
      // Usar uma busca insensível a maiúsculas/minúsculas se possível (SQLite é por padrão em muitos casos)
      let subject = await prisma.studySubject.findFirst({
        where: { 
          name: { contains: subjectName },
          userId 
        }
      });

      if (!subject) {
        subject = await prisma.studySubject.create({
          data: {
            name: subjectName,
            userId,
            priority: 1
          }
        });
      }

      // 4. Criar o material
      const material = await (prisma as any).studyMaterial.create({
        data: {
          userId,
          subjectId: subject.id,
          fileName,
          originalFileName: fileName,
          sourceType: "LOCAL_INBOX",
          sourcePath: fullPath,
          fileHash: fileHash,
          fileSize: fs.statSync(fullPath).size,
          totalPages: pdfData.numpages,
          organizationStatus: "ANALYZING", // Pronto para detectar estrutura
          processingStatus: "PENDING"
        }
      });

      results.push({ 
        fileName, 
        status: "SUCCESS", 
        id: material.id, 
        subjectName: subject.name 
      });

    } catch (error: any) {
      console.error(`Erro ao importar ${fileName}:`, error);
      results.push({ fileName, status: "ERROR", error: error.message });
    }
  }

  return NextResponse.json({ results });
}
