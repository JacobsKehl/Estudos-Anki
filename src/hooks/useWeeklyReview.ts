"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TopicResult } from "@/lib/weekly-review-ui";

// Types representing the API response shapes
export interface WeeklyReviewTopic {
  id: string;
  sessionId: string;
  subjectName: string;
  title: string;
  selectionReason: string;
  priorityRank: number;
  result: TopicResult;
  notes: string | null;
  carriedFromTopicId: string | null;
  sourceStudyDate: string | null;
  materialName: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  sources: Array<{ id: string; studyBlockId: string }>;
}

export interface WeeklyReviewSession {
  id: string;
  userId: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  originalScheduledDate: string;
  effectiveScheduledDate: string;
  missedBehavior: string;
  availableMinutes: number | null;
  targetQuestionCount: number | null;
  actualQuestionCount: number | null;
  startedAt: string | null;
  completedAt: string | null;
  skippedAt: string | null;
  createdAt: string;
  updatedAt: string;
  topics: WeeklyReviewTopic[];
}

export interface WeeklyReviewPreview {
  userId: string;
  referenceDate: string;
  originalScheduledDate: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  activeStudyDates: string[];
  availableMinutes?: number;
  suggestedQuestionCount?: number;
  totals: {
    selected: number;
    weekContent: number;
    overdue: number;
    longUnseen: number;
    excessWeekContent: number;
    excessOverdue: number;
  };
  topics: Array<{
    studyBlockId: string;
    subjectId: string;
    subjectName: string;
    title: string;
    sourceStudyDate: string;
    materialName?: string;
    pageStart?: number;
    pageEnd?: number;
    selectionReason: "WEEK_CONTENT" | "OVERDUE" | "LONG_UNSEEN";
    carriedFromTopicId?: string;
    groupKey: string;
    suggestedQuestions?: number;
  }>;
  excluded: Array<{ studyBlockId: string; reason: string }>;
}

export type TopicSaveState = "idle" | "saving" | "saved" | "error";

export type ReviewPhase =
  | "loading"
  | "disabled"
  | "preview-form"
  | "preview-topics"
  | "pending-session"
  | "in-progress"
  | "completed"
  | "error";

const DRAFT_KEY_PREFIX = "weekly-review-draft:";

function getDraftKey(sessionId: string): string {
  return `${DRAFT_KEY_PREFIX}${sessionId}`;
}

function saveDraft(sessionId: string, data: { availableMinutes: number; targetQuestionCount: number }) {
  try {
    sessionStorage.setItem(getDraftKey(sessionId), JSON.stringify(data));
  } catch {
    // sessionStorage unavailable
  }
}

function loadDraft(sessionId: string): { availableMinutes: number; targetQuestionCount: number } | null {
  try {
    const raw = sessionStorage.getItem(getDraftKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearDraft(sessionId: string) {
  try {
    sessionStorage.removeItem(getDraftKey(sessionId));
  } catch {
    // sessionStorage unavailable
  }
}

export function useWeeklyReview() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Core state
  const [phase, setPhase] = useState<ReviewPhase>("loading");
  const [session, setSession] = useState<WeeklyReviewSession | null>(null);
  const [preview, setPreview] = useState<WeeklyReviewPreview | null>(null);
  const [weeklyReviewEnabled, setWeeklyReviewEnabled] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Per-topic save states
  const [topicSaveStates, setTopicSaveStates] = useState<Record<string, TopicSaveState>>({});

  // Abort any in-flight requests
  const abortPrevious = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  // Fetch session by ID and update state canonically
  const fetchSessionById = useCallback(
    async (sessionId: string, signal?: AbortSignal) => {
      const res = await fetch(`/api/weekly-review/sessions/${sessionId}`, { signal });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Erro ao buscar sessão.");
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Erro ao buscar sessão.");
      return json.data as WeeklyReviewSession;
    },
    []
  );

  // Canonical refresh: after any mutation, re-fetch session and normalize
  const refreshSession = useCallback(
    async (sessionId: string) => {
      const signal = abortPrevious();
      try {
        const fresh = await fetchSessionById(sessionId, signal);
        if (!fresh) {
          setSession(null);
          setPhase("preview-form");
          return;
        }

        // Sort topics by priorityRank
        fresh.topics.sort((a, b) => a.priorityRank - b.priorityRank);
        setSession(fresh);

        // Determine phase from status
        switch (fresh.status) {
          case "PENDING":
            setPhase("pending-session");
            break;
          case "IN_PROGRESS":
            setPhase("in-progress");
            break;
          case "COMPLETED":
          case "SKIPPED":
            setPhase("completed");
            break;
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        throw err;
      }
    },
    [abortPrevious, fetchSessionById]
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const signal = abortPrevious();

      try {
        const urlSessionId = searchParams.get("sessionId");

        if (urlSessionId) {
          // Direct link to a specific session
          const sess = await fetchSessionById(urlSessionId, signal);
          if (cancelled) return;

          if (sess) {
            sess.topics.sort((a, b) => a.priorityRank - b.priorityRank);
            setSession(sess);
            setWeeklyReviewEnabled(true);
            switch (sess.status) {
              case "PENDING":
                setPhase("pending-session");
                break;
              case "IN_PROGRESS":
                setPhase("in-progress");
                break;
              case "COMPLETED":
              case "SKIPPED":
                setPhase("completed");
                break;
            }
            return;
          }
        }

        // No sessionId in URL → check preferences + active session
        const [prefsRes, activeRes] = await Promise.all([
          fetch("/api/weekly-review/preferences", { signal }),
          fetch("/api/weekly-review/sessions/active", { signal }),
        ]);

        if (cancelled) return;

        if (prefsRes.ok) {
          const prefsJson = await prefsRes.json();
          if (prefsJson.success && prefsJson.data) {
            setWeeklyReviewEnabled(prefsJson.data.enabled);
          }
        }

        if (activeRes.ok) {
          const activeJson = await activeRes.json();
          if (activeJson.success && activeJson.data?.session) {
            const sess = activeJson.data.session as WeeklyReviewSession;
            sess.topics.sort((a, b) => a.priorityRank - b.priorityRank);
            setSession(sess);

            // Update URL with sessionId for resumability
            router.replace(`/weekly-review?sessionId=${sess.id}`, { scroll: false });

            switch (sess.status) {
              case "PENDING":
                setPhase("pending-session");
                break;
              case "IN_PROGRESS":
                setPhase("in-progress");
                break;
              case "COMPLETED":
              case "SKIPPED":
                setPhase("completed");
                break;
            }
            return;
          }
        }

        // No active session
        if (cancelled) return;
        setPhase(weeklyReviewEnabled ? "preview-form" : "disabled");
      } catch (err: any) {
        if (err.name === "AbortError" || cancelled) return;
        setErrorMessage("Erro ao carregar dados da revisão semanal.");
        setPhase("error");
      }
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-derive phase when weeklyReviewEnabled changes (after init)
  useEffect(() => {
    if (phase === "loading") return;
    if (!session && !weeklyReviewEnabled) {
      setPhase("disabled");
    } else if (!session && weeklyReviewEnabled && phase === "disabled") {
      setPhase("preview-form");
    }
  }, [weeklyReviewEnabled, session, phase]);

  // --- Mutation helpers ---

  const fetchPreview = useCallback(
    async (availableMinutes: number) => {
      setIsMutating(true);
      const signal = abortPrevious();

      try {
        const res = await fetch("/api/weekly-review/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ availableMinutes }),
          signal,
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          const msg = json.error?.message || "Erro ao gerar prévia.";
          toast.error(msg);
          return;
        }

        setPreview(json.data.preview);
        setWeeklyReviewEnabled(json.data.weeklyReviewEnabled);
        setPhase("preview-topics");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        toast.error("Erro de conexão ao gerar prévia.");
      } finally {
        setIsMutating(false);
      }
    },
    [abortPrevious]
  );

  const prepareSession = useCallback(async () => {
    setIsMutating(true);
    const signal = abortPrevious();

    try {
      const res = await fetch("/api/weekly-review/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || "Erro ao preparar sessão.";
        toast.error(msg);
        return;
      }

      const sess = json.data.session as WeeklyReviewSession;
      sess.topics.sort((a, b) => a.priorityRank - b.priorityRank);
      setSession(sess);
      setPhase("pending-session");

      router.replace(`/weekly-review?sessionId=${sess.id}`, { scroll: false });
      toast.success(json.data.created ? "Sessão criada com sucesso!" : "Sessão existente recuperada.");
    } catch (err: any) {
      if (err.name === "AbortError") return;
      toast.error("Erro de conexão ao preparar sessão.");
    } finally {
      setIsMutating(false);
    }
  }, [abortPrevious, router]);

  const startSession = useCallback(
    async (availableMinutes: number, targetQuestionCount: number) => {
      if (!session) return;
      setIsMutating(true);
      const signal = abortPrevious();

      try {
        const res = await fetch(`/api/weekly-review/sessions/${session.id}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ availableMinutes, targetQuestionCount }),
          signal,
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          // Handle 409 conflict by refreshing session state
          if (res.status === 409) {
            await refreshSession(session.id);
            toast.info("A sessão já foi atualizada. Estado recarregado.");
            return;
          }
          toast.error(json.error?.message || "Erro ao iniciar sessão.");
          return;
        }

        clearDraft(session.id);
        await refreshSession(session.id);
        toast.success("Sessão iniciada!");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        toast.error("Erro de conexão ao iniciar sessão.");
      } finally {
        setIsMutating(false);
      }
    },
    [session, abortPrevious, refreshSession]
  );

  const skipSession = useCallback(async () => {
    if (!session) return;
    setIsMutating(true);
    const signal = abortPrevious();

    try {
      const res = await fetch(`/api/weekly-review/sessions/${session.id}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 409) {
          await refreshSession(session.id);
          toast.info("A sessão já foi atualizada. Estado recarregado.");
          return;
        }
        toast.error(json.error?.message || "Erro ao pular sessão.");
        return;
      }

      clearDraft(session.id);
      await refreshSession(session.id);
      toast.success("Sessão pulada.");
    } catch (err: any) {
      if (err.name === "AbortError") return;
      toast.error("Erro de conexão ao pular sessão.");
    } finally {
      setIsMutating(false);
    }
  }, [session, abortPrevious, refreshSession]);

  const carrySession = useCallback(
    async (newDate: string) => {
      if (!session) return;
      setIsMutating(true);
      const signal = abortPrevious();

      try {
        const res = await fetch(`/api/weekly-review/sessions/${session.id}/carry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newEffectiveScheduledDate: newDate }),
          signal,
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          if (res.status === 409) {
            await refreshSession(session.id);
            toast.info("A sessão já foi atualizada. Estado recarregado.");
            return;
          }
          toast.error(json.error?.message || "Erro ao adiar sessão.");
          return;
        }

        clearDraft(session.id);
        await refreshSession(session.id);
        toast.success("Sessão transferida com sucesso!");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        toast.error("Erro de conexão ao adiar sessão.");
      } finally {
        setIsMutating(false);
      }
    },
    [session, abortPrevious, refreshSession]
  );

  const completeSession = useCallback(
    async (actualQuestionCount: number) => {
      if (!session) return;
      setIsMutating(true);
      const signal = abortPrevious();

      try {
        const res = await fetch(`/api/weekly-review/sessions/${session.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actualQuestionCount }),
          signal,
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          if (res.status === 409) {
            await refreshSession(session.id);
            toast.info("A sessão já foi atualizada. Estado recarregado.");
            return;
          }
          toast.error(json.error?.message || "Erro ao concluir sessão.");
          return;
        }

        await refreshSession(session.id);
        toast.success("Sessão concluída com sucesso!");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        toast.error("Erro de conexão ao concluir sessão.");
      } finally {
        setIsMutating(false);
      }
    },
    [session, abortPrevious, refreshSession]
  );

  const recordTopicResult = useCallback(
    async (topicId: string, result: TopicResult, notes?: string) => {
      if (!session) return;

      setTopicSaveStates((prev) => ({ ...prev, [topicId]: "saving" }));

      try {
        const res = await fetch(
          `/api/weekly-review/sessions/${session.id}/topics/${topicId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result, notes: notes ?? "" }),
          }
        );

        const json = await res.json();
        if (!res.ok || !json.success) {
          setTopicSaveStates((prev) => ({ ...prev, [topicId]: "error" }));
          toast.error(json.error?.message || "Erro ao salvar resultado.");
          return;
        }

        setTopicSaveStates((prev) => ({ ...prev, [topicId]: "saved" }));

        // Refresh session to get canonical topic state
        await refreshSession(session.id);
      } catch {
        setTopicSaveStates((prev) => ({ ...prev, [topicId]: "error" }));
        toast.error("Erro de conexão ao salvar resultado.");
      }
    },
    [session, refreshSession]
  );

  const resetToForm = useCallback(() => {
    setSession(null);
    setPreview(null);
    setTopicSaveStates({});
    setPhase("preview-form");
    router.replace("/weekly-review", { scroll: false });
  }, [router]);

  return {
    // State
    phase,
    session,
    preview,
    weeklyReviewEnabled,
    isMutating,
    errorMessage,
    topicSaveStates,

    // Actions
    fetchPreview,
    prepareSession,
    startSession,
    skipSession,
    carrySession,
    completeSession,
    recordTopicResult,
    resetToForm,

    // Draft helpers
    saveDraft,
    loadDraft,
    clearDraft,
  };
}
