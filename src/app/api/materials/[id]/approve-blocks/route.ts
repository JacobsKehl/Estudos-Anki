/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mockUserId = await getMockUserId(); 

  try {
    const { blocks } = await req.json();

    if (!blocks || !Array.isArray(blocks)) {
      return NextResponse.json({ error: "Dados de blocos inválidos" }, { status: 400 });
    }

    const material = await prisma.studyMaterial.findFirst({
      where: { id, userId: mockUserId },
      include: {
        _count: {
          select: { studyBlocks: true }
        }
      }
    });

    if (!material || !material.subjectId) {
      return NextResponse.json({ error: "Material não encontrado ou acesso não autorizado." }, { status: 404 });
    }

    // Validação de segurança: páginas devem estar dentro do limite do material
    const maxPages = material.totalPages || 999;
    
    // Obter o último orderIndex existente para esta matéria
    const lastBlock = await prisma.studyBlock.findFirst({
      where: { subjectId: material.subjectId as string },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    });
    
    let currentOrderIndex = (lastBlock?.orderIndex ?? -1) + 1;

    // Filtrar e validar blocos antes de salvar
    const validBlocks = blocks.filter(b => 
      b.title?.trim() && 
      b.pageStart > 0 && 
      b.pageEnd >= b.pageStart &&
      b.pageStart <= maxPages
    );

    if (validBlocks.length === 0) {
      return NextResponse.json({ error: "Nenhum bloco válido para salvar" }, { status: 400 });
    }

    // Criação dos blocos
    // Usamos um loop simples para garantir que cada um seja criado e possamos logar se necessário
    const results = [];
    for (const block of validBlocks) {
      if (!material.subjectId) continue;
      const created = await prisma.studyBlock.create({
        data: {
          userId: mockUserId,
          subjectId: material.subjectId,
          materialId: material.id,
          title: block.title.trim(),
          description: block.description || "",
          pageStart: Math.min(block.pageStart, maxPages),
          pageEnd: Math.min(block.pageEnd, maxPages),
          estimatedStudyMinutes: block.estimatedStudyMinutes || 30,
          orderIndex: currentOrderIndex++,
          status: "NOT_STARTED",
        }
      });
      results.push(created);
    }

    return NextResponse.json({ 
      message: `${results.length} blocos criados com sucesso!`,
      count: results.length,
      blocks: results 
    });
  } catch (error: any) {
    console.error("Erro crítico ao aprovar blocos:", error);
    return NextResponse.json({ 
      error: "Erro interno ao salvar os blocos no banco de dados.",
      details: error.message 
    }, { status: 500 });
  }
}
