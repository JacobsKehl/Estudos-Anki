import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    // 1. Pegar usuário (temporário: pegando o primeiro ou criando um dev)
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { name: "Usuário Dev", email: "dev@kehl.study" }
      });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

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
      return NextResponse.json({ error: "Falha ao salvar arquivo na nuvem", details: uploadError.message }, { status: 500 });
    }

    // 3. Criar registro no Banco de Dados
    const material = await prisma.studyMaterial.create({
      data: {
        userId: user.id,
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
    return NextResponse.json({ error: "Erro interno no servidor", details: error.message }, { status: 500 });
  }
}
