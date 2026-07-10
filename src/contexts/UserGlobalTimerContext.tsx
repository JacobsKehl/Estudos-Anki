"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";

export interface UserGlobalTimerContextValue {
  elapsedSeconds: number;
  isRunning: boolean;
  isIdle: boolean;
  startedAt: string | null; // ISO string
  pausedAt: string | null; // ISO string
  lastUpdatedAt: number;
  isHydrated: boolean;
  userId: string;
  startOrResume(): void;
  pause(): void;
  resume(): void;
  reset(): void;
}

interface PersistedGlobalTimerState {
  userId: string;
  accumulatedSeconds: number;
  runningSince: number | null; // ms timestamp
  isRunning: boolean;
  startedAt: string | null; // ISO string
  pausedAt: string | null; // ISO string
  lastPersistedAt: number;
  revision: number;
}

const getStorageKey = (userId: string) => userId ? `user-global-timer:${userId}` : "";

function getDefaultState(userId: string): PersistedGlobalTimerState {
  return {
    userId,
    accumulatedSeconds: 0,
    runningSince: null,
    isRunning: false,
    startedAt: null,
    pausedAt: null,
    lastPersistedAt: Date.now(),
    revision: 0,
  };
}

function sanitizeState(parsed: any, userId: string): PersistedGlobalTimerState {
  const defaultState = getDefaultState(userId);
  if (!parsed || typeof parsed !== "object") return defaultState;

  const sanitized = { ...defaultState };

  if (typeof parsed.userId === "string") {
    sanitized.userId = parsed.userId;
  }

  if (typeof parsed.accumulatedSeconds === "number" && Number.isFinite(parsed.accumulatedSeconds) && parsed.accumulatedSeconds >= 0) {
    sanitized.accumulatedSeconds = parsed.accumulatedSeconds;
  }

  if (typeof parsed.runningSince === "number" && Number.isFinite(parsed.runningSince) && parsed.runningSince > 0) {
    if (parsed.runningSince > Date.now() + 5000) {
      sanitized.runningSince = Date.now();
    } else {
      sanitized.runningSince = parsed.runningSince;
    }
  } else {
    sanitized.runningSince = null;
  }

  if (typeof parsed.isRunning === "boolean") {
    sanitized.isRunning = parsed.isRunning;
  }

  if (sanitized.isRunning && !sanitized.runningSince) {
    sanitized.runningSince = Date.now();
  } else if (!sanitized.isRunning) {
    sanitized.runningSince = null;
  }

  if (typeof parsed.startedAt === "string") {
    sanitized.startedAt = parsed.startedAt;
  }

  if (typeof parsed.pausedAt === "string") {
    sanitized.pausedAt = parsed.pausedAt;
  }

  if (typeof parsed.lastPersistedAt === "number" && Number.isFinite(parsed.lastPersistedAt)) {
    sanitized.lastPersistedAt = parsed.lastPersistedAt;
  }

  if (typeof parsed.revision === "number" && Number.isFinite(parsed.revision) && parsed.revision >= 0) {
    sanitized.revision = parsed.revision;
  }

  return sanitized;
}

const UserGlobalTimerContext = createContext<UserGlobalTimerContextValue | undefined>(undefined);

export function UserGlobalTimerProvider({ children }: { children: React.ReactNode }) {
  const { preferences, isLoading: prefsLoading } = useStudyPreferences();
  const userId = preferences.userId || "";

  const [state, setState] = useState<PersistedGlobalTimerState | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const stateRef = useRef<PersistedGlobalTimerState | null>(null);
  const unmountInProgressRef = useRef(false);

  const commitState = useCallback((nextState: PersistedGlobalTimerState) => {
    const key = getStorageKey(userId);
    const stateToSave = {
      ...nextState,
      lastPersistedAt: Date.now(),
    };
    stateRef.current = stateToSave;
    setState(stateToSave);

    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(stateToSave));
    } catch (e) {
      console.error("Erro ao gravar localStorage no cronômetro geral:", e);
    }
  }, [userId]);

  const getElapsedFromState = useCallback((s: PersistedGlobalTimerState) => {
    if (!s.isRunning || !s.runningSince) {
      return s.accumulatedSeconds;
    }
    const elapsed = s.accumulatedSeconds + Math.floor((Date.now() - s.runningSince) / 1000);
    return Math.max(0, elapsed);
  }, []);

  // Reset hydration when userId changes
  useEffect(() => {
    if (userId) {
      setIsHydrated(false);
    }
  }, [userId]);

  // Load state on mount / change of userId
  useEffect(() => {
    if (prefsLoading || !userId) {
      setIsHydrated(false);
      stateRef.current = null;
      setState(null);
      setElapsedSeconds(0);
      return;
    }

    let loadedState: PersistedGlobalTimerState | null = null;
    const key = getStorageKey(userId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.userId === userId) {
          loadedState = sanitizeState(parsed, userId);
        } else {
          loadedState = getDefaultState(userId);
        }
      }
    } catch {
      console.warn("Falha ao analisar JSON do cronômetro geral, reiniciando.");
    }

    if (!loadedState) {
      loadedState = getDefaultState(userId);
    }

    stateRef.current = loadedState;
    setState(loadedState);
    setElapsedSeconds(getElapsedFromState(loadedState));
    setIsHydrated(true);
  }, [userId, prefsLoading, getElapsedFromState]);

  // Sincronização multi-abas em tempo real
  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === getStorageKey(userId) && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          const incoming = sanitizeState(parsed, userId);
          if (incoming.userId === userId) {
            const currentRev = stateRef.current ? stateRef.current.revision : -1;
            if (incoming.revision > currentRev) {
              stateRef.current = incoming;
              setState(incoming);
              setElapsedSeconds(getElapsedFromState(incoming));
            }
          }
        } catch (e) {
          console.error("Erro ao sincronizar cronômetro geral entre abas:", e);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [userId, getElapsedFromState]);

  // Dynamic ticking interval when running
  useEffect(() => {
    if (!state || !state.isRunning) return;

    const interval = setInterval(() => {
      const currentState = stateRef.current;
      if (!currentState || !currentState.isRunning) return;

      const elapsed = getElapsedFromState(currentState);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [state, getElapsedFromState]);

  // Handle logout: clean up state when userId goes empty or changes
  useEffect(() => {
    if (!prefsLoading && !userId) {
      const key = getStorageKey(userId);
      if (key && stateRef.current && stateRef.current.isRunning) {
        const paused = {
          ...stateRef.current,
          isRunning: false,
          runningSince: null,
        };
        try {
          localStorage.setItem(key, JSON.stringify(paused));
        } catch {}
      }
      stateRef.current = null;
      setState(null);
      setElapsedSeconds(0);
      setIsHydrated(false);
    }
  }, [userId, prefsLoading]);

  // Salvar snapshot do cronômetro geral no desmonte (cronômetro continua rodando normalmente)
  useEffect(() => {
    unmountInProgressRef.current = false;
    return () => {
      unmountInProgressRef.current = true;
      try {
        const currentState = stateRef.current;
        const key = getStorageKey(userId);
        if (key && currentState && currentState.isRunning && currentState.runningSince) {
          const now = Date.now();
          const elapsed = currentState.accumulatedSeconds + Math.floor((now - currentState.runningSince) / 1000);
          const snapshotState = {
            ...currentState,
            accumulatedSeconds: Math.max(0, elapsed),
            runningSince: now,
            lastPersistedAt: now,
          };
          localStorage.setItem(key, JSON.stringify(snapshotState));
        }
      } catch (e) {
        console.error("Erro ao salvar snapshot do cronômetro geral no desmonte:", e);
      }
    };
  }, [userId]);

  const startOrResume = useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState) return;

    // Guarda: Se já estiver rodando, não altera o estado, não reinicia runningSince e não incrementa a revisão
    if (currentState.isRunning) return;

    const now = Date.now();
    const nextState: PersistedGlobalTimerState = {
      ...currentState,
      isRunning: true,
      runningSince: now,
      startedAt: currentState.startedAt || new Date().toISOString(),
      pausedAt: null,
      revision: currentState.revision + 1,
    };
    commitState(nextState);
    setElapsedSeconds(getElapsedFromState(nextState));
  }, [commitState, getElapsedFromState]);

  const pause = useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState || !currentState.isRunning) return;

    const elapsed = getElapsedFromState(currentState);
    const nextState: PersistedGlobalTimerState = {
      ...currentState,
      isRunning: false,
      runningSince: null,
      accumulatedSeconds: Math.max(0, elapsed),
      pausedAt: new Date().toISOString(),
      revision: currentState.revision + 1,
    };
    commitState(nextState);
    setElapsedSeconds(elapsed);
  }, [commitState, getElapsedFromState]);

  const resume = useCallback(() => {
    startOrResume();
  }, [startOrResume]);

  const reset = useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState) return;

    const nextState: PersistedGlobalTimerState = {
      ...currentState,
      isRunning: false,
      runningSince: null,
      accumulatedSeconds: 0,
      startedAt: null,
      pausedAt: null,
      revision: currentState.revision + 1,
    };
    commitState(nextState);
    setElapsedSeconds(0);
  }, [commitState]);

  const value: UserGlobalTimerContextValue = {
    elapsedSeconds,
    isRunning: state?.isRunning ?? false,
    isIdle: !state?.isRunning && elapsedSeconds === 0,
    startedAt: state?.startedAt ?? null,
    pausedAt: state?.pausedAt ?? null,
    lastUpdatedAt: state?.lastPersistedAt ?? 0,
    isHydrated,
    userId,
    startOrResume,
    pause,
    resume,
    reset,
  };

  return (
    <UserGlobalTimerContext.Provider value={value}>
      {children}
    </UserGlobalTimerContext.Provider>
  );
}

export function useUserGlobalTimer() {
  const context = useContext(UserGlobalTimerContext);
  if (context === undefined) {
    throw new Error("useUserGlobalTimer deve ser usado dentro de um UserGlobalTimerProvider");
  }
  return context;
}
