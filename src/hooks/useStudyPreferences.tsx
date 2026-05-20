"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

export interface StudyPreferences {
  name: string;
  studyFocus: string;
  dailyGoalMinutes: number;
  flashcardDifficulty: string;
  emailReminderEnabled: boolean;
  emailReminderTime: string;
  dailyReminderEmail: string;
  displayDensity: "comfortable" | "compact";
  animations: "normal" | "reduced";
}

const DEFAULT_PREFERENCES: StudyPreferences = {
  name: "Henrique Kehl",
  studyFocus: "Ciência da Computação & Inteligência Artificial",
  dailyGoalMinutes: 120,
  flashcardDifficulty: "NORMAL_PLUS",
  emailReminderEnabled: true,
  emailReminderTime: "08:00",
  dailyReminderEmail: "gabriela.furtado.p@gmail.com",
  displayDensity: "comfortable",
  animations: "normal",
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
  const applyVisualPreferences = (density: "comfortable" | "compact", animations: "normal" | "reduced") => {
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
        applyVisualPreferences(merged.displayDensity, merged.animations);
      } else {
        // Apply defaults immediately
        applyVisualPreferences(DEFAULT_PREFERENCES.displayDensity, DEFAULT_PREFERENCES.animations);
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
          name: dbPrefs.name ?? preferences.name,
          studyFocus: dbPrefs.studyFocus ?? preferences.studyFocus,
          dailyGoalMinutes: Number(dbPrefs.dailyGoalMinutes) || preferences.dailyGoalMinutes,
          flashcardDifficulty: dbPrefs.flashcardDifficulty ?? preferences.flashcardDifficulty,
          emailReminderEnabled: dbPrefs.emailReminderEnabled ?? preferences.emailReminderEnabled,
          emailReminderTime: dbPrefs.emailReminderTime ?? preferences.emailReminderTime,
          dailyReminderEmail: dbPrefs.dailyReminderEmail ?? preferences.dailyReminderEmail,
          displayDensity: (dbPrefs.displayDensity as any) ?? preferences.displayDensity,
          animations: (dbPrefs.animations as any) ?? preferences.animations,
        };
        
        setPreferences(merged);
        applyVisualPreferences(merged.displayDensity, merged.animations);
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

  const updatePreferences = async (newPrefs: Partial<StudyPreferences>): Promise<boolean> => {
    // 1. Optimistic Update in UI & localStorage
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);
    applyVisualPreferences(updated.displayDensity, updated.animations);
    
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
      toast.error("Salvo localmente, mas não conseguimos sincronizar com o banco.");
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
