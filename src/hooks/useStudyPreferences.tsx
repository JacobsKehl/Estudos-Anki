"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

export interface StudyPreferences {
  name: string;
  displayName: string;
  studyFocus: string;
  focusArea: string;
  dailyGoalMinutes: number;
  studyResetTime: string;
  studyDaysOfWeek: string;
  defaultBlockDurationMinutes: number;
  maxNewCardsPerDay: number;
  flashcardDifficulty: string;
  emailReminderEnabled: boolean;
  emailReminderTime: string;
  dailyReminderEmail: string;
  displayDensity: "comfortable" | "compact";
  visualDensity: "comfortable" | "compact";
  animations: "normal" | "reduced";
  reducedMotion: boolean;
  theme: "light" | "dark" | "system";
  examGoal: string;
  deadline: string | null;
  avatarUrl: string | null;
}

const DEFAULT_PREFERENCES: StudyPreferences = {
  name: "Gabriela Furtado",
  displayName: "Gabriela",
  studyFocus: "Estudando para TRT4",
  focusArea: "Estudando para TRT4",
  dailyGoalMinutes: 120,
  studyResetTime: "00:00",
  studyDaysOfWeek: "1,2,3,4,5,6,0", // 7 dias por semana por padrão
  defaultBlockDurationMinutes: 30,
  maxNewCardsPerDay: 20,
  flashcardDifficulty: "NORMAL_PLUS",
  emailReminderEnabled: true,
  emailReminderTime: "08:00",
  dailyReminderEmail: "gabriela.furtado.p@gmail.com",
  displayDensity: "comfortable",
  visualDensity: "comfortable",
  animations: "normal",
  reducedMotion: false,
  theme: "system",
  examGoal: "TRT4",
  deadline: "2026-11-30",
  avatarUrl: null,
};

interface StudyPreferencesContextType {
  preferences: StudyPreferences;
  updatePreferences: (newPrefs: Partial<StudyPreferences>) => Promise<boolean>;
  isLoading: boolean;
  syncWithServer: () => Promise<void>;
}

const StudyPreferencesContext = createContext<StudyPreferencesContextType | undefined>(undefined);

export function StudyPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<StudyPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Apply UI classes for CSS-first density and animation preferences
  const applyVisualPreferences = (
    density: "comfortable" | "compact",
    animations: "normal" | "reduced",
    theme: "light" | "dark" | "system"
  ) => {
    if (typeof window === "undefined") return;
    
    const root = document.documentElement;
    
    // Density classes
    if (density === "compact") {
      root.classList.add("density-compact");
      root.classList.remove("density-comfortable");
    } else {
      root.classList.add("density-comfortable");
      root.classList.remove("density-compact");
    }
    
    // Animation classes
    if (animations === "reduced") {
      root.classList.add("motion-reduce");
      root.classList.remove("motion-normal");
    } else {
      root.classList.add("motion-normal");
      root.classList.remove("motion-reduce");
    }

    // Theme classes
    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  // Load from localStorage immediately (Zero-FOUC)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const stored = localStorage.getItem("kehl_study_preferences");
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = { ...DEFAULT_PREFERENCES, ...parsed };
        setPreferences(merged);
        applyVisualPreferences(merged.displayDensity, merged.animations, merged.theme);
      } else {
        // Apply defaults immediately
        applyVisualPreferences(DEFAULT_PREFERENCES.displayDensity, DEFAULT_PREFERENCES.animations, DEFAULT_PREFERENCES.theme);
      }
    } catch (e) {
      console.error("Erro ao carregar preferências locais:", e);
    }
  }, []);

  // Fetch and synchronize from database on load
  const syncWithServer = async () => {
    try {
      const res = await fetch("/api/preferences");
      if (res.ok) {
        const dbPrefs = await res.json();
        
        // Merge DB preferences into current state, preserving db schema keys
        const merged: StudyPreferences = {
          name: dbPrefs.name ?? dbPrefs.displayName ?? preferences.name,
          displayName: dbPrefs.displayName ?? dbPrefs.name ?? preferences.displayName,
          studyFocus: dbPrefs.studyFocus ?? dbPrefs.focusArea ?? preferences.studyFocus,
          focusArea: dbPrefs.focusArea ?? dbPrefs.studyFocus ?? preferences.focusArea,
          dailyGoalMinutes: Number(dbPrefs.dailyGoalMinutes) || preferences.dailyGoalMinutes,
          studyResetTime: dbPrefs.studyResetTime ?? preferences.studyResetTime,
          studyDaysOfWeek: dbPrefs.studyDaysOfWeek ?? preferences.studyDaysOfWeek,
          defaultBlockDurationMinutes: Number(dbPrefs.defaultBlockDurationMinutes) || preferences.defaultBlockDurationMinutes,
          maxNewCardsPerDay: Number(dbPrefs.maxNewCardsPerDay) || preferences.maxNewCardsPerDay,
          flashcardDifficulty: dbPrefs.flashcardDifficulty ?? preferences.flashcardDifficulty,
          emailReminderEnabled: dbPrefs.emailReminderEnabled ?? preferences.emailReminderEnabled,
          emailReminderTime: dbPrefs.emailReminderTime ?? preferences.emailReminderTime,
          dailyReminderEmail: dbPrefs.dailyReminderEmail ?? preferences.dailyReminderEmail,
          displayDensity: (dbPrefs.displayDensity ?? dbPrefs.visualDensity as any) ?? preferences.displayDensity,
          visualDensity: (dbPrefs.visualDensity ?? dbPrefs.displayDensity as any) ?? preferences.visualDensity,
          animations: (dbPrefs.animations as any) ?? preferences.animations,
          reducedMotion: dbPrefs.reducedMotion ?? (dbPrefs.animations ? dbPrefs.animations === "reduced" : preferences.reducedMotion),
          theme: (dbPrefs.theme as any) ?? preferences.theme,
          examGoal: dbPrefs.examGoal ?? preferences.examGoal,
          deadline: dbPrefs.deadline ? new Date(dbPrefs.deadline).toISOString().split('T')[0] : preferences.deadline,
          avatarUrl: dbPrefs.avatarUrl ?? preferences.avatarUrl,
        };
        
        setPreferences(merged);
        applyVisualPreferences(merged.displayDensity, merged.animations, merged.theme);
        localStorage.setItem("kehl_study_preferences", JSON.stringify(merged));
      }
    } catch (e) {
      console.error("Erro ao sincronizar preferências com servidor:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    syncWithServer();
  }, []);

  // Listen to system theme changes if set to 'system'
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (preferences.theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const root = document.documentElement;
      if (mediaQuery.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    // Use modern or fallback listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }
    
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [preferences.theme]);

  const updatePreferences = async (newPrefs: Partial<StudyPreferences>): Promise<boolean> => {
    // 1. Optimistic Update in UI & localStorage
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);
    applyVisualPreferences(updated.displayDensity, updated.animations, updated.theme);
    
    if (typeof window !== "undefined") {
      localStorage.setItem("kehl_study_preferences", JSON.stringify(updated));
    }

    // 2. Persist to DB in the background
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
      
      if (!res.ok) {
        throw new Error("Resposta do servidor não amigável");
      }
      return true;
    } catch (e) {
      console.error("Erro ao salvar preferências no banco:", e);
      // Only show error toast for non-theme changes (theme is already saved locally)
      const isThemeOnlyChange = Object.keys(newPrefs).length === 1 && newPrefs.theme !== undefined;
      if (!isThemeOnlyChange) {
        toast.error("Salvo localmente, mas não conseguimos sincronizar com o banco.");
      }
      return false;
    }
  };

  return (
    <StudyPreferencesContext.Provider value={{ preferences, updatePreferences, isLoading, syncWithServer }}>
      {children}
    </StudyPreferencesContext.Provider>
  );
}

export function useStudyPreferences() {
  const context = useContext(StudyPreferencesContext);
  if (context === undefined) {
    throw new Error("useStudyPreferences deve ser usado dentro de um StudyPreferencesProvider");
  }
  return context;
}
