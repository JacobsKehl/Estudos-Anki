import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-mock";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { getSessionUser } from "@/lib/supabase-server";
import { getReviewBacklogSize } from "@/lib/reviews/get-review-backlog-size";
import { CFC_FILE_NAMES } from "@/lib/scheduler/config";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const userId = await getCurrentUserId();

  // 1. Buscar usuário
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      createdAt: true,
      lastLoginAt: true
    }
  });

  const sessionUser = await getSessionUser();
  const emailVerified = sessionUser ? !!sessionUser.email_confirmed_at : true;
  const provider = sessionUser?.app_metadata?.provider === "email"
    ? "E-mail e Senha"
    : sessionUser?.app_metadata?.provider
      ? `OAuth (${sessionUser.app_metadata.provider})`
      : "Simulação de Desenvolvimento";

  const userEmail = user?.email || "dev@kehl.study";

  const authData = {
    email: userEmail,
    emailVerified,
    provider,
    createdAt: user?.createdAt || new Date(),
    lastLoginAt: user?.lastLoginAt || new Date()
  };

  // 2. Buscar estatísticas dos blocos — conteúdo principal = os 5 PDFs do
  // CFC (decisão do Henrique, 17/09/2026), nunca uma contagem sem escopo.
  const totalBlocks = await prisma.studyBlock.count({
    where: { userId, material: { originalFileName: { in: [...CFC_FILE_NAMES] } } }
  });

  const completedBlocks = await prisma.studyBlock.count({
    where: {
      userId,
      theoryStatus: "COMPLETED",
      material: { originalFileName: { in: [...CFC_FILE_NAMES] } }
    }
  });

  // 3. Buscar blocos pendentes para cálculo de viabilidade (ignorando material de suporte) das matérias do ciclo ativo
  const subjects = await prisma.studySubject.findMany({
    where: { userId },
    select: { id: true, studyPriority: true }
  });

  const activeSubjectIds = subjects
    .filter(s => s.studyPriority === "PRIMARY" || s.studyPriority === "ACTIVE")
    .map(s => s.id);

  const pendingBlocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      subjectId: { in: activeSubjectIds },
      theoryStatus: "NOT_STARTED",
      material: {
        materialRole: {
          not: "SUPPORT_MATERIAL"
        }
      }
    },
    select: {
      estimatedStudyMinutes: true
    }
  });

  const remainingBlockMinutes = pendingBlocks.reduce(
    (acc, block) => acc + (block.estimatedStudyMinutes || 30),
    0
  );

  // 4. Buscar flashcards
  const now = new Date();
  const pendingFlashcardsToday = await getReviewBacklogSize(userId, now);

  // 5. Buscar revisões do usuário para calcular dias estudados e sequência (streak)
  const reviews = await prisma.flashcardReview.findMany({
    where: { userId },
    select: { reviewedAt: true },
    orderBy: { reviewedAt: "desc" }
  });

  // Extrair datas locais únicas no formato YYYY-MM-DD
  const uniqueDays = Array.from(
    new Set(
      reviews.map(r => {
        try {
          // Ajustar data local
          const d = new Date(r.reviewedAt);
          return d.toISOString().split("T")[0];
        } catch {
          return null;
        }
      }).filter(Boolean) as string[]
    )
  ).sort((a, b) => b.localeCompare(a)); // Ordenado do mais recente para o mais antigo

  const daysStudied = uniqueDays.length;

  // Calcular a sequência atual (streak)
  let currentStreak = 0;
  if (daysStudied > 0) {
    const todayStr = new Date().toISOString().split("T")[0];
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Se o último dia estudado for hoje ou ontem, calculamos a sequência
    const lastStudiedStr = uniqueDays[0];
    if (lastStudiedStr === todayStr || lastStudiedStr === yesterdayStr) {
      currentStreak = 1;
      const checkDate = new Date(lastStudiedStr);

      for (let i = 1; i < uniqueDays.length; i++) {
        // Subtrair um dia do dia sendo checado
        checkDate.setDate(checkDate.getDate() - 1);
        const checkDateStr = checkDate.toISOString().split("T")[0];
        
        if (uniqueDays[i] === checkDateStr) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }

  // 6. Progresso do cronograma ativo
  const activeSchedule = await prisma.studySchedule.findFirst({
    where: { userId, status: "ACTIVE" }
  });

  let scheduleProgress = 0;
  if (activeSchedule) {
    const totalItems = await prisma.studyScheduleItem.count({
      where: { scheduleId: activeSchedule.id }
    });
    
    if (totalItems > 0) {
      const completedItems = await prisma.studyScheduleItem.count({
        where: { scheduleId: activeSchedule.id, status: "COMPLETED" }
      });
      scheduleProgress = (completedItems / totalItems) * 100;
    }
  }

  const stats = {
    daysStudied,
    currentStreak,
    completedBlocks,
    totalBlocks,
    reviewedFlashcards: reviews.length,
    pendingFlashcardsToday,
    scheduleProgress,
    remainingBlockMinutes
  };

  return <ProfileClient userEmail={userEmail} stats={stats} authData={authData} />;
}
