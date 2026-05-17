import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { getMockUserId } from "@/lib/auth-mock";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const userId = await getMockUserId();

    // Validar duplicado por nome
    const existing = await prisma.studyMaterial.findFirst({
      where: {
        userId,
        fileName: file.name
      }
    });

    if (existing) {
      return NextResponse.json({ 
        error: "duplicate", 
        message: `O arquivo "${file.name}" já existe na sua biblioteca.` 
      }, { status: 409 });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // 2. Upload para Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('materials')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error("Erro no upload para Supabase:", uploadError);
      return NextResponse.json({ 
        error: "storage_error", 
        message: `Falha ao salvar o arquivo "${file.name}" na nuvem.`,
        details: uploadError.message 
      }, { status: 500 });
    }

    // 3. Criar registro no Banco de Dados
    const material = await prisma.studyMaterial.create({
      data: {
        userId: userId,
        fileName: file.name,
        originalFileName: file.name,
        sourceType: "CLOUD_UPLOAD",
        sourcePath: uploadData.path, // Caminho dentro do bucket
        mimeType: file.type,
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
      details: error.message 
    }, { status: 500 });
  }
}
