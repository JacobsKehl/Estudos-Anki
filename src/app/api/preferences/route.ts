import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export async function GET() {
  try {
    const userId = await getMockUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        dailyGoalMinutes: true,
        studyFocus: true,
        flashcardDifficulty: true,
        emailReminderEnabled: true,
        emailReminderTime: true,
        dailyReminderEmail: true,
        displayDensity: true,
        animations: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Erro ao obter preferências:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getMockUserId();
    const body = await request.json();

    // Validação básica e mapeamento de campos
    const data: any = {};
    
    if (body.name !== undefined) data.name = body.name;
    if (body.dailyGoalMinutes !== undefined) data.dailyGoalMinutes = parseInt(body.dailyGoalMinutes, 10) || 120;
    if (body.studyFocus !== undefined) data.studyFocus = body.studyFocus;
    if (body.flashcardDifficulty !== undefined) data.flashcardDifficulty = body.flashcardDifficulty;
    if (body.emailReminderEnabled !== undefined) data.emailReminderEnabled = Boolean(body.emailReminderEnabled);
    if (body.emailReminderTime !== undefined) data.emailReminderTime = body.emailReminderTime;
    if (body.dailyReminderEmail !== undefined) data.dailyReminderEmail = body.dailyReminderEmail;
    if (body.displayDensity !== undefined) data.displayDensity = body.displayDensity;
    if (body.animations !== undefined) data.animations = body.animations;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        dailyGoalMinutes: true,
        studyFocus: true,
        flashcardDifficulty: true,
        emailReminderEnabled: true,
        emailReminderTime: true,
        dailyReminderEmail: true,
        displayDensity: true,
        animations: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Erro ao salvar preferências:", error);
    return NextResponse.json({ error: "Erro interno ao salvar preferências" }, { status: 500 });
  }
}
