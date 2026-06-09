import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch all users to find Henrique
    const users = await prisma.user.findMany({
      include: {
        preferences: true
      }
    });

    const henrique = users.find(u => 
      u.email?.toLowerCase().includes("henrique") || 
      u.name?.toLowerCase().includes("henrique")
    );

    if (!henrique) {
      return NextResponse.json({ 
        error: "Henrique not found in database",
        allUsers: users.map(u => ({ id: u.id, email: u.email, name: u.name }))
      });
    }

    // 2. Fetch Henrique's details
    const subjects = await prisma.studySubject.findMany({
      where: { userId: henrique.id }
    });

    const materials = await prisma.studyMaterial.findMany({
      where: { userId: henrique.id },
      include: {
        subject: {
          select: { name: true }
        }
      }
    });

    const blocks = await prisma.studyBlock.findMany({
      where: { userId: henrique.id }
    });

    const schedules = await prisma.studySchedule.findMany({
      where: { userId: henrique.id },
      include: {
        items: {
          take: 5
        }
      }
    });

    return NextResponse.json({
      success: true,
      user: {
        id: henrique.id,
        name: henrique.name,
        email: henrique.email,
        preferences: henrique.preferences
      },
      subjectsCount: subjects.length,
      subjects: subjects.map(s => ({ id: s.id, name: s.name, priority: s.studyPriority })),
      materialsCount: materials.length,
      materials: materials.map(m => ({
        id: m.id,
        fileName: m.fileName,
        subjectName: m.subject?.name,
        processingStatus: m.processingStatus,
        organizationStatus: m.organizationStatus,
        processingError: m.processingError,
        createdAt: m.createdAt
      })),
      blocksCount: blocks.length,
      blocksSummary: {
        completed: blocks.filter(b => b.status === "COMPLETED").length,
        inProgress: blocks.filter(b => b.status === "IN_PROGRESS").length,
        notStarted: blocks.filter(b => b.status === "NOT_STARTED").length
      },
      schedulesCount: schedules.length,
      schedules: schedules.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        itemsCount: s.items.length
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
