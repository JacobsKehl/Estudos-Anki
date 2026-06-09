import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = "cmpvqi7bp0000kz043wp09yja"; // ID do Henrique
    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId");

    if (materialId) {
      const pages = await prisma.extractedContent.findMany({
        where: { materialId },
        orderBy: { pageNumber: "asc" }
      });
      return NextResponse.json({
        success: true,
        materialId,
        pagesCount: pages.length,
        pages: pages.map(p => ({
          pageNumber: p.pageNumber,
          textLength: p.text.length,
          text: p.text
        }))
      });
    }

    
    // 1. Fetch user & preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true }
    });

    if (!user) {
      return NextResponse.json({ error: "Henrique not found" });
    }

    // 2. Fetch subjects
    const subjects = await prisma.studySubject.findMany({
      where: { userId }
    });

    // 3. Fetch materials
    const materials = await prisma.studyMaterial.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    // 4. Fetch blocks
    const blocks = await prisma.studyBlock.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    // 5. Fetch schedules
    const schedules = await prisma.studySchedule.findMany({
      where: { userId },
      include: {
        items: {
          orderBy: { dayNumber: "asc" }
        }
      }
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        preferences: user.preferences
      },
      subjects: subjects.map(s => ({ id: s.id, name: s.name })),
      materialsCount: materials.length,
      materials: materials.map(m => ({
        id: m.id,
        fileName: m.fileName,
        processingStatus: m.processingStatus,
        organizationStatus: m.organizationStatus,
        processingError: m.processingError,
        totalPages: m.totalPages,
        subjectId: m.subjectId,
        detectedStructure: m.detectedStructure,
        createdAt: m.createdAt
      })),
      blocksCount: blocks.length,
      blocks: blocks.map(b => ({
        id: b.id,
        title: b.title,
        status: b.status,
        pageStart: b.pageStart,
        pageEnd: b.pageEnd,
        officialTopicName: b.officialTopicName,
        materialId: b.materialId,
        createdAt: b.createdAt
      })),
      schedulesCount: schedules.length,
      schedules: schedules.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        itemsCount: s.items.length,
        items: s.items.map(it => ({
          id: it.id,
          dayNumber: it.dayNumber,
          actionType: it.actionType,
          status: it.status,
          scheduledDate: it.scheduledDate
        }))
      }))
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
