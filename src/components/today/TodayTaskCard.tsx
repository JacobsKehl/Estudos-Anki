"use client";

import { useState } from "react";
import {
  BookOpen, RotateCw, CheckCircle2,
  Clock, Layers, Loader2, Sparkles, BrainCircuit
} from "lucide-react";


import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type ActionType =
  | "THEORY" | "REVIEW_BLOCK";

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
    color: "text-blue-600",
    bgColor: "bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  REVIEW_BLOCK: {
    label: "Revisão de conteúdo",
    icon: RotateCw,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function TodayTaskCard({ item, index }: TodayTaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDone, setIsDone] = useState(item.status === "COMPLETED");
  const router = useRouter();

  const actionType = ((item.actionType === "THEORY" || item.actionType === "REVIEW_BLOCK") ? item.actionType : "THEORY") as ActionType;
  const config = ACTION_CONFIG[actionType];

  const flashcardCount = item.studyBlock?._count?.flashcards ?? 0;
  const hasFlashcards = flashcardCount > 0;

  const handleGenerateCards = async () => {
    if (!item.studyBlockId) return;
    setIsGenerating(true);
    const toastId = toast.loading("Analisando conteúdo e gerando flashcards de alta fidelidade...");
    try {
      const res = await fetch(`/api/blocks/${item.studyBlockId}/flashcards/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar flashcards");
      }
      toast.success(data.message || `${data.count} flashcards gerados com sucesso!`, { id: toastId });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar flashcards com IA.", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCompleteStep = async () => {
    if (!item.studyBlockId) return;
    setIsCompleting(true);

    try {
      const stepMap: Record<ActionType, "THEORY" | "THEORY"> = {
        THEORY: "THEORY",
        REVIEW_BLOCK: "THEORY",
      };
      const step = stepMap[actionType];

      await fetch(`/api/study-blocks/${item.studyBlockId}/complete-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step }),
      });

      if (!item._fromQueue && item.id) {
        await fetch(`/api/schedule/items/${item.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED" }),
        });
      }

      setIsDone(true);
      toast.success(`"${item.studyBlock?.title ?? "Tarefa"}" concluída!`);
      router.refresh();
    } catch {
      toast.error("Erro ao concluir tarefa.");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div
      className={`border rounded-2xl p-5 space-y-4 transition-all duration-300 ${
        isDone ? "opacity-60 bg-muted/20 border-border/50" : `${config.bgColor} border`
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-semibold ${
            isDone ? "bg-muted text-muted-foreground" : `${config.color} bg-white dark:bg-black/20 shadow-sm border border-black/5`
          }`}>
            {isDone ? <CheckCircle2 className="w-5 h-5" /> : index}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{item.subject?.name}</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-bold ${config.badgeColor}`}>
                {config.label}
              </span>
            </div>
            {item.studyBlock && (
              <p className="text-sm font-medium text-foreground/80 mt-0.5">
                {item.studyBlock.title}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span>{item.estimatedMinutes ?? 60} min</span>
        </div>
      </div>

      {item.studyBlock?.pageStart && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-[52px]">
          <Layers className="w-3.5 h-3.5 opacity-70" />
          <span>Páginas {item.studyBlock.pageStart}–{item.studyBlock.pageEnd}</span>
        </div>
      )}

      {item.reason && (
        <div className="flex items-start gap-2 pl-[52px]">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-40" />
          <p className="text-xs text-foreground/60 italic leading-relaxed">{item.reason}</p>
        </div>
      )}

      {!isDone && (
        <div className="flex items-center gap-2 pl-[52px] pt-1">
          {item.studyBlockId && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg h-9 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => router.push(`/blocks/${item.studyBlockId}`)}
            >
              Ver detalhes
            </Button>
          )}

          {item.studyBlockId && (
            <>
              {hasFlashcards ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg h-9 px-3 text-xs font-semibold border-accent/20 text-accent hover:bg-accent/5 flex items-center gap-1.5 transition-all"
                  onClick={() => router.push(`/practice?blockId=${item.studyBlockId}`)}
                >
                  <BrainCircuit className="w-3.5 h-3.5" />
                  Praticar Cards ({flashcardCount})
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg h-9 px-3 text-xs font-semibold border-accent/20 text-accent hover:bg-accent/5 flex items-center gap-1.5 transition-all"
                  onClick={handleGenerateCards}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-accent" />
                  )}
                  {isGenerating ? "Gerando..." : "Gerar Cards (IA)"}
                </Button>
              )}
            </>
          )}

          <Button
            size="sm"
            className="rounded-lg h-9 px-4 text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:opacity-90"
            onClick={handleCompleteStep}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Concluir conteúdo
          </Button>
        </div>
      )}
    </div>
  );
}
