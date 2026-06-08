import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export async function GET() {
  try {
    const userId = await getMockUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Auto-migration: if preferences do not exist, create them
    if (!user.preferences) {
      const createdPrefs = await prisma.userPreferences.create({
        data: {
          userId: user.id,
          dailyGoalMinutes: 120,
          studyResetTime: "00:00",
          studyDaysOfWeek: "0,1,2,3,4,5,6",
          defaultBlockDurationMinutes: 30,
          maxNewCardsPerDay: 20,
          flashcardDifficulty: "NORMAL",
          emailReminderEnabled: false,
          emailReminderTime: "08:00",
          dailyReminderEmail: null,
          visualDensity: "comfortable",
          reducedMotion: false,
          focusArea: "Geral",
          displayName: user.name || "Estudante",
          examGoal: "Estudos",
          deadline: null,
          avatarUrl: null,
          theme: "light",
          languageTone: "MASCULINE_NEUTRAL",
        },
      });
      return NextResponse.json({
        ...createdPrefs,
        name: user.name || "Estudante",
        studyFocus: "Geral",
        displayDensity: "comfortable",
        animations: "normal",
        theme: "light",
      });
    }

    // Return combined preferences with backward compatibility keys
    return NextResponse.json({
      ...user.preferences,
      name: user.preferences.displayName,
      studyFocus: user.preferences.focusArea,
      displayDensity: user.preferences.visualDensity,
      animations: user.preferences.reducedMotion ? "reduced" : "normal",
      theme: user.preferences.theme,
    });
  } catch (error) {
    console.error("Erro ao obter preferências:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getMockUserId();
    const body = await request.json();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const data: any = {};
    if (body.dailyGoalMinutes !== undefined) data.dailyGoalMinutes = parseInt(body.dailyGoalMinutes, 10);
    if (body.studyResetTime !== undefined) data.studyResetTime = body.studyResetTime;
    if (body.studyDaysOfWeek !== undefined) data.studyDaysOfWeek = body.studyDaysOfWeek;
    if (body.defaultBlockDurationMinutes !== undefined) data.defaultBlockDurationMinutes = parseInt(body.defaultBlockDurationMinutes, 10);
    if (body.maxNewCardsPerDay !== undefined) data.maxNewCardsPerDay = parseInt(body.maxNewCardsPerDay, 10);
    if (body.flashcardDifficulty !== undefined) data.flashcardDifficulty = body.flashcardDifficulty;
    if (body.emailReminderEnabled !== undefined) data.emailReminderEnabled = Boolean(body.emailReminderEnabled);
    if (body.emailReminderTime !== undefined) data.emailReminderTime = body.emailReminderTime;
    if (body.dailyReminderEmail !== undefined) {
      data.dailyReminderEmail = body.dailyReminderEmail ? String(body.dailyReminderEmail).trim() : null;
    }
    
    if (body.visualDensity !== undefined) {
      data.visualDensity = body.visualDensity;
    } else if (body.displayDensity !== undefined) {
      data.visualDensity = body.displayDensity;
    }
    
    if (body.reducedMotion !== undefined) {
      data.reducedMotion = Boolean(body.reducedMotion);
    } else if (body.animations !== undefined) {
      data.reducedMotion = body.animations === "reduced";
    }

    if (body.focusArea !== undefined) {
      data.focusArea = body.focusArea;
    } else if (body.studyFocus !== undefined) {
      data.focusArea = body.studyFocus;
    }

    if (body.displayName !== undefined) {
      data.displayName = body.displayName;
    } else if (body.name !== undefined) {
      data.displayName = body.name;
    }

    if (body.examGoal !== undefined) data.examGoal = body.examGoal;
    if (body.deadline !== undefined) {
      data.deadline = body.deadline ? new Date(body.deadline) : null;
    }
    if (body.scheduleGenerationMode !== undefined) {
      const mode = body.scheduleGenerationMode;
      data.scheduleGenerationMode = (mode === "LEGACY_TRT4" || mode === "DYNAMIC") ? mode : "DYNAMIC";
    }
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;
    if (body.theme !== undefined) data.theme = body.theme;
    if (body.languageTone !== undefined) {
      const val = body.languageTone;
      data.languageTone = (val === "FEMININE" || val === "MASCULINE_NEUTRAL") ? val : "MASCULINE_NEUTRAL";
    }

    let updatedPrefs;
    if (!user.preferences) {
      updatedPrefs = await prisma.userPreferences.create({
        data: {
          userId: user.id,
          ...data,
        },
      });
    } else {
      updatedPrefs = await prisma.userPreferences.update({
        where: { userId },
        data,
      });
    }

    // Synchronize name on User table if provided
    const userUpdateData: any = {};
    if (body.name !== undefined) userUpdateData.name = body.name;
    if (body.displayName !== undefined) userUpdateData.name = body.displayName;

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    return NextResponse.json({
      ...updatedPrefs,
      name: updatedPrefs.displayName,
      studyFocus: updatedPrefs.focusArea,
      displayDensity: updatedPrefs.visualDensity,
      animations: updatedPrefs.reducedMotion ? "reduced" : "normal",
      theme: updatedPrefs.theme,
    });
  } catch (error) {
    console.error("Erro ao salvar preferências:", error);
    return NextResponse.json({ error: "Erro interno ao salvar preferências" }, { status: 500 });
  }
}
