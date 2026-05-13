"use client";

import { useState } from "react";
import {
  BookOpen, BrainCircuit, RotateCw, Zap, CheckCircle2,
  Clock, Layers, ChevronRight, Loader2, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type ActionType =
  | "THEORY" | "QUESTIONS" | "GENERATE_FLASHCARDS"
  | "REVIEW_BLOCK" | "REVIEW_FLASHCARDS" | "REINFORCEMENT";

interface TodayTaskCardProps {
  item: any;
  index: number;
}

// ─── Action Config ──────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<ActionType, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  badgeColor: string;
}> = {
  THEORY: {
    label: "Teoria",
    icon: BookOpen,
    color: "text-sky-600",
    bgColor: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/40",
    badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  },
  QUESTIONS: {
    label: "Questões",
    icon: Zap,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40",
    badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  },
  GENERATE_FLASHCARDS: {
    label: "Gerar Flashcards",
    icon: BrainCircuit,
    color: "text-violet-600",
    bgColor: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/40",
    badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  },
  REVIEW_BLOCK: {
    label: "Revisão",
    icon: RotateCw,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
  REVIEW_FLASHCARDS: {
    label: "Flashcards",
    icon: RotateCw,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  REINFORCEMENT: {
    label: "Reforço",
    icon: Zap,
    color: "text-rose-600",
    bgColor: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40",
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function TodayTaskCard({ item, index }: TodayTaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDone, setIsDone] = useState(item.status === "COMPLETED");
  const router = useRouter();

  const actionType = (item.actionType ?? "THEORY") as ActionType;
  const config = ACTION_CONFIG[actionType] ?? ACTION_CONFIG.THEORY;
  const Icon = config.icon;

  const handleCompleteStep = async () => {
    if (!item.studyBlockId) return;
    setIsCompleting(true);

    try {
      // 1. Marcar etapa de estudo como concluída
      const stepMap: Record<ActionType, "THEORY" | "QUESTIONS" | "FLASHCARDS" | null> = {
        THEORY: "THEORY",
        QUESTIONS: "QUESTIONS",
        GENERATE_FLASHCARDS: "FLASHCARDS",
        REVIEW_BLOCK: "THEORY", // Revisão conta como rever a teoria
        REINFORCEMENT: "THEORY",
        REVIEW_FLASHCARDS: null,
      };
      const step = stepMap[actionType];

      if (step) {
        await fetch(`/api/study-blocks/${item.studyBlockId}/complete-step`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step }),
        });
      }

      // 2. Marcar item do cronograma como concluído (se não for da fila direta)
      if (!item._fromQueue && item.id) {
        await fetch(`/api/schedule/items/${item.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED" }),
        });
      }

      setIsDone(true);
      toast.success(`"${item.studyBlock?.title ?? "Tarefa"}" concluída! Revisões agendadas.`);
      router.refresh();
    } catch {
      toast.error("Erro ao concluir tarefa.");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div
      className={`border rounded-3xl p-6 space-y-5 transition-all duration-300 ${
        isDone ? "opacity-60 bg-muted/30 border-border/30" : config.bgColor
      }`}
    >
      {/* Header: número + matéria + ação */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Número da tarefa */}
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold ${
            isDone ? "bg-muted text-muted-foreground" : `${config.color} bg-white dark:bg-black/10 shadow-sm`
          }`}>
            {isDone ? <CheckCircle2 className="w-5 h-5" /> : index}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base">{item.subject?.name}</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.badgeColor}`}>
                <Icon className="w-3 h-3" />
                {config.label}
              </span>
            </div>
            {item.studyBlock && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-tight">
                {item.studyBlock.title}
              </p>
            )}
          </div>
        </div>

        {/* Tempo estimado */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
          <Clock className="w-4 h-4" />
          <span>{item.estimatedMinutes ?? 60} min</span>
        </div>
      </div>

      {/* Páginas do bloco */}
      {item.studyBlock?.pageStart && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-14">
          <Layers className="w-3.5 h-3.5" />
          Páginas {item.studyBlock.pageStart}–{item.studyBlock.pageEnd}
          {item.studyBlock.material?.fileName && (
            <span className="opacity-60">· {item.studyBlock.material.fileName}</span>
          )}
        </div>
      )}

      {/* Motivo da recomendação */}
      {item.reason && (
        <div className="flex items-start gap-2 pl-14">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />
          <p className="text-xs text-foreground/70 italic leading-relaxed">{item.reason}</p>
        </div>
      )}

      {/* Ações */}
      {!isDone && (
        <div className="flex items-center gap-3 pl-14">
          <Button
            size="sm"
            className="rounded-xl gap-2"
            onClick={handleCompleteStep}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Concluir etapa
          </Button>

          {item.studyBlockId && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl gap-1 text-muted-foreground"
              onClick={() => router.push(`/blocks/${item.studyBlockId}`)}
            >
              Ver bloco
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
