import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { getMockUserId } from "@/lib/auth-mock";
import { checkRateLimit, rateLimitErrorResponse } from "@/lib/rate-limit";

/**
 * Sanitiza o nome do arquivo prevenindo XSS, path traversal e caracteres inválidos
 */
function sanitizeFileName(name: string): string {
  // 1. Remover padrões de path traversal (../ e ..\)
  let cleanName = name.replace(/(\.\.[\/\\])/g, "");
  
  // 2. Extrair apenas o nome base (caso o caminho contenha barras adicionais)
  cleanName = cleanName.split(/[/\\]/).pop() || "";
  
  // 3. Remover caracteres inválidos de sistemas de arquivos (\ / : * ? " < > |)
  cleanName = cleanName.replace(/[\\/:*?"<>|]/g, "_");
  
  // 4. Remover espaços duplicados e aparar pontas
  cleanName = cleanName.trim().replace(/\s+/g, " ");

  // 5. Garantir que tenha a extensão correta
  if (!cleanName.toLowerCase().endsWith(".pdf")) {
    cleanName += ".pdf";
  }

  // 6. Fallback seguro se o nome final for inválido/vazio
  if (cleanName === ".pdf" || !cleanName) {
    cleanName = `material_${Date.now()}.pdf`;
  }

  return cleanName;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    // 1. Validações estritas de Formato e Tipo MIME
    const isPDFMime = file.type === "application/pdf";
    const isPDFExt = file.name.toLowerCase().endsWith(".pdf");
    
    if (!isPDFMime || !isPDFExt) {
      return NextResponse.json({ 
        error: "invalid_format", 
        message: "Envie apenas arquivos PDF de até 50MB." 
      }, { status: 400 });
    }

    // 2. Validação estrita de tamanho (máximo 50MB)
    const MAX_SIZE = 50 * 1024 * 1024; // 50 megabytes
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ 
        error: "file_too_large", 
        message: "Envie apenas arquivos PDF de até 50MB." 
      }, { status: 400 });
    }

    const userId = await getMockUserId();

    // Rate Limiting: 10 uploads por 15 minutos por usuário
    const rateLimitKey = `upload:${userId}`;
    const rateCheck = await checkRateLimit(rateLimitKey, 10, 900);
    if (!rateCheck.success) {
      return rateLimitErrorResponse(rateCheck.reset);
    }

    // 3. Sanitização do nome do arquivo
    const sanitizedName = sanitizeFileName(file.name);

    // 4. Validar duplicado por nome já sanitizado
    const existing = await prisma.studyMaterial.findFirst({
      where: {
        userId,
        fileName: sanitizedName
      }
    });

    if (existing) {
      return NextResponse.json({ 
        error: "duplicate", 
        message: `O arquivo "${sanitizedName}" já existe na sua biblioteca.` 
      }, { status: 409 });
    }

    // Gerar caminho interno seguro usando UUID e prevenindo path traversal
    const fileExt = "pdf";
    const secureStorageFileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${userId}/${secureStorageFileName}`;

    // 5. Upload para o Supabase Storage (com buffer)
    const buffer = Buffer.from(await file.arrayBuffer());
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('materials')
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) {
      console.error("Erro no upload para o Supabase Storage:", uploadError);
      return NextResponse.json({ 
        error: "storage_error", 
        message: `Falha ao salvar o arquivo "${sanitizedName}" na nuvem.`,
      }, { status: 500 });
    }

    // 6. Criar registro no Banco de Dados
    const material = await prisma.studyMaterial.create({
      data: {
        userId: userId,
        fileName: sanitizedName,
        originalFileName: sanitizedName,
        sourceType: "CLOUD_UPLOAD",
        sourcePath: uploadData.path, // Caminho seguro dentro do bucket
        mimeType: "application/pdf",
        fileSize: file.size,
        organizationStatus: "UPLOADED"
      }
    });

    return NextResponse.json({ 
      message: "Upload concluído com sucesso", 
      materialId: material.id,
      fileName: material.fileName 
    });

  } catch (error: any) {
    console.error("Erro fatal no upload:", error);
    return NextResponse.json({ 
      error: "server_error", 
      message: "Erro interno no servidor ao tentar processar o upload.",
    }, { status: 500 });
  }
}
