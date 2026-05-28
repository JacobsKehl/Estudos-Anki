"use client";

import React, { useState } from "react";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { ProfileHero } from "./ProfileHero";
import { ProfileProgressCards } from "./ProfileProgressCards";
import { ProfileStudyRoutine } from "./ProfileStudyRoutine";
import { ProfilePlanStatus } from "./ProfilePlanStatus";
import { ProfileEditModal } from "./ProfileEditModal";
import { calculatePlanViability } from "@/lib/study/plan-viability";
import { PageHeader } from "@/components/ui/page-header";
import { User } from "lucide-react";
import { toast } from "sonner";
import { AccountSecurityCard } from "./AccountSecurityCard";
import { getUserCopy } from "@/lib/user-copy";

interface ProfileClientProps {
  userEmail: string;
  stats: {
    daysStudied: number;
    currentStreak: number;
    completedBlocks: number;
    totalBlocks: number;
    reviewedFlashcards: number;
    pendingFlashcardsToday: number;
    scheduleProgress: number;
    remainingBlockMinutes: number;
  };
  authData: {
    email: string;
    emailVerified: boolean;
    provider: string;
    createdAt: string | Date;
    lastLoginAt: string | Date | null;
  };
}

export function ProfileClient({ userEmail, stats, authData }: ProfileClientProps) {
  const { preferences, updatePreferences } = useStudyPreferences();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const copy = getUserCopy(preferences.languageTone);

  // Calcular a viabilidade com base nas preferências atuais (sincronizadas no hook)
  const viability = React.useMemo(() => {
    // Prazo padrão de fallback se não definido nas preferências
    const deadlineVal = preferences.deadline || "2026-11-30";
    return calculatePlanViability({
      remainingBlockMinutes: stats.remainingBlockMinutes,
      dailyGoalMinutes: preferences.dailyGoalMinutes,
      flashcardMinutesPerDay: 30,
      deadline: deadlineVal,
      studyDaysOfWeek: preferences.studyDaysOfWeek || "1,2,3,4,5,6,0"
    });
  }, [preferences, stats.remainingBlockMinutes]);

  const handleSavePreferences = async (newPrefs: any) => {
    try {
      const success = await updatePreferences(newPrefs);
      if (success) {
        toast.success("Perfil de estudos atualizado com sucesso!");
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao salvar as alterações.");
      return false;
    }
  };

  return (
    <div className="space-y-10 max-w-6xl animate-in fade-in duration-700 pb-20">
      
      {/* Cabeçalho de Página */}
      <PageHeader 
        icon={User}
        title={copy.profileTitle}
        description="Visualize sua identidade, rotina de estudo e a viabilidade do seu cronograma rumo à aprovação."
      />

      {/* Grid Principal */}
      <div className="space-y-8">
        
        {/* Seção 1: Hero de Identidade */}
        <ProfileHero
          displayName={preferences.displayName || preferences.name}
          email={userEmail}
          focusArea={preferences.focusArea || preferences.studyFocus}
          examGoal={preferences.examGoal}
          deadline={preferences.deadline}
          studyDaysOfWeek={preferences.studyDaysOfWeek}
          avatarUrl={preferences.avatarUrl}
          onEditClick={() => setIsEditOpen(true)}
        />

        {/* Seção 2: Cards de Progresso Rápido */}
        <ProfileProgressCards
          daysStudied={stats.daysStudied}
          currentStreak={stats.currentStreak}
          completedBlocks={stats.completedBlocks}
          totalBlocks={stats.totalBlocks}
          reviewedFlashcards={stats.reviewedFlashcards}
          pendingFlashcardsToday={stats.pendingFlashcardsToday}
          scheduleProgress={stats.scheduleProgress}
        />

        {/* Seção 3: Grade com Rotina e Viabilidade */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ProfileStudyRoutine
            dailyGoalMinutes={preferences.dailyGoalMinutes}
            studyResetTime={preferences.studyResetTime}
            studyDaysOfWeek={preferences.studyDaysOfWeek}
            flashcardDifficulty={preferences.flashcardDifficulty}
            visualDensity={preferences.visualDensity}
            reducedMotion={preferences.reducedMotion}
            emailReminderEnabled={preferences.emailReminderEnabled}
            emailReminderTime={preferences.emailReminderTime}
            dailyReminderEmail={preferences.dailyReminderEmail}
          />

          <ProfilePlanStatus
            isViable={viability.isViable}
            deficitHours={viability.deficitHours}
            surplusHours={viability.surplusHours}
            daysRemaining={viability.daysRemaining}
            studyDaysRemaining={viability.studyDaysRemaining}
            requiredHours={viability.requiredHours}
            totalAvailableHours={viability.totalAvailableHours}
            recommendedDailyMinutes={viability.recommendedDailyMinutes}
            dailyGoalMinutes={preferences.dailyGoalMinutes}
          />
        </div>

        {/* Seção 4: Conta & Segurança */}
        <AccountSecurityCard
          email={authData.email}
          emailVerified={authData.emailVerified}
          provider={authData.provider}
          createdAt={authData.createdAt}
          lastLoginAt={authData.lastLoginAt}
        />

      </div>

      {/* Modal de Edição */}
      <ProfileEditModal
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        preferences={preferences}
        onSave={handleSavePreferences}
      />

    </div>
  );
}
