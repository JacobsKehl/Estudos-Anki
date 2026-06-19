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
  | "THEORY" | "REVIEW_BLOCK" | "REVIEW_FLASHCARDS";

interface TodayTaskCardProps {
  item: any;
  index: number;
  isAdvanced?: boolean;
  variant?: "study" | "review";
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
    color: "text-accent",
    bgColor: "bg-sage-light/20 dark:bg-accent/5 border-sage-light/40 dark:border-accent/10",
    badgeColor: "border border-[#C8D8B8] bg-[#EEF3E8] text-[#4F6F45] dark:bg-[#4F6F45]/25 dark:border-[#C8D8B8]/20 dark:text-[#d1e2c4]",
  },
  REVIEW_BLOCK: {
    label: "Revisão de conteúdo",
    icon: RotateCw,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30",
    badgeColor: "border border-emerald-200 bg-[#e6f4ea] text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/30 dark:text-emerald-200",
  },
  REVIEW_FLASHCARDS: {
    label: "Revisão Cards",
    icon: BrainCircuit,
    color: "text-purple-600",
    bgColor: "bg-purple-50/50 dark:bg-purple-950/10 border-purple-100 dark:border-purple-900/30",
    badgeColor: "border border-purple-200 bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:border-purple-800/30 dark:text-purple-200",
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function TodayTaskCard({ item, index, isAdvanced, variant = "study" }: TodayTaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [isDone, setIsDone] = useState(item.status === "COMPLETED");
  const router = useRouter();

  const actionType = ((item.actionType === "THEORY" || item.actionType === "REVIEW_BLOCK" || item.actionType === "REVIEW_FLASHCARDS") ? item.actionType : "THEORY") as ActionType;
  const config = ACTION_CONFIG[actionType];

  const isFlashcard = item.actionType === "REVIEW_FLASHCARDS";
  const displaySubject = isFlashcard ? "Revisão Geral" : (item.subject?.name || "Matéria");
  const displayTitle = isFlashcard ? "Revisão Geral de Flashcards" : (item.studyBlock?.title || "Bloco");

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

  const handleGenerateMoreCards = async () => {
    if (!item.studyBlockId) return;
    setIsGeneratingMore(true);
    const toastId = toast.loading("Analisando conteúdo e gerando mais flashcards adicionais...");
    try {
      const res = await fetch(`/api/blocks/${item.studyBlockId}/flashcards/generate-more`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar flashcards adicionais");
      }
      toast.success(data.message || `${data.count} novos flashcards gerados!`, { id: toastId });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar mais flashcards com IA.", { id: toastId });
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const handleCompleteStep = async () => {
    if (!item.studyBlockId) return;
    setIsCompleting(true);

    try {
      const stepMap: Record<ActionType, "THEORY"> = {
        THEORY: "THEORY",
        REVIEW_BLOCK: "THEORY",
        REVIEW_FLASHCARDS: "THEORY",
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

  if (variant === "review") {
    return (
      <div
        className="bg-[#F8FAF5] dark:bg-[#162215]/40 border border-[#D9E5D0] dark:border-accent/15 rounded-2xl p-4 hover:bg-[#F7FAF4] dark:hover:bg-accent/10 transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {/* Discrete decorative icon */}
            <RotateCw className="w-4 h-4 text-accent/60 mt-0.5 shrink-0" />
            
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-xs text-[#25324A] dark:text-foreground/90">
                  {displaySubject}
                </span>
                
                <span className="px-2 py-0.5 rounded bg-[#EAF2E4] dark:bg-[#4F6F45]/20 text-[#4F6F45] dark:text-[#d1e2c4] border border-[#C8D8B8] dark:border-[#C8D8B8]/20 text-[9px] uppercase tracking-wider font-bold">
                  {isFlashcard ? "Revisão Geral de Cards" : "Revisão de Conteúdo"}
                </span>

                {flashcardCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F1F5EC] dark:bg-muted/30 text-[#6F875B] dark:text-muted-foreground border border-[#DDE8D4] dark:border-muted/30 text-[9px] uppercase tracking-wider font-bold">
                    <Layers className="w-2.5 h-2.5" />
                    {flashcardCount} {flashcardCount === 1 ? "card ativo" : "cards ativos"}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-[#25324A] dark:text-foreground/80 leading-snug">
                {displayTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center sm:self-center self-end pl-7 sm:pl-0 shrink-0">
            {item.studyBlockId && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-[11px] font-semibold border-[#D9E5D0] dark:border-accent/15 text-[#4F6F45] dark:text-accent hover:bg-[#EAF2E4]/50 dark:hover:bg-accent/10 transition-all rounded-lg"
                onClick={() => router.push(`/blocks/${item.studyBlockId}?scheduleItemId=${item.id}&returnTo=/`)}
              >
                Ver conteúdo
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
  const isBlockCompleted = item.studyBlock?.status === "COMPLETED";
  const isSubjectExcluded = item.studyBlock?.subject?.studyPriority === "EXCLUDED";
  const isSupportMaterial = item.studyBlock?.material?.materialRole === "SUPPORT_MATERIAL";
  const showGenerateMore = 
    !isFlashcard && 
    !!item.studyBlockId && 
    isBlockCompleted && 
    !isSubjectExcluded && 
    !isSupportMaterial && 
    item.actionType === "THEORY" &&
    hasFlashcards;

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
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm">{displaySubject}</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-bold ${config.badgeColor}`}>
                {config.label}
              </span>
              {isAdvanced && (
                <span className="px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  ADIANTADO
                </span>
              )}
            </div>
            {(item.studyBlock || isFlashcard) && (
              <p className="text-sm font-medium text-foreground/80 mt-0.5">
                {displayTitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span>{item.estimatedMinutes ?? (item.actionType === "REVIEW_BLOCK" ? 0 : 60)} min</span>
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

      {isAdvanced && (
        <div className="flex items-start gap-2 pl-[52px] pt-1">
          <p className="text-xs text-muted-foreground/75 leading-relaxed italic">
            Este conteúdo estava previsto para o próximo dia de estudo. Ao concluir agora, ele não ficará pendente depois.
          </p>
        </div>
      )}

      {item.studyBlock?.supportMaterials && item.studyBlock.supportMaterials.length > 0 && (
        <div className="flex flex-col gap-1.5 pl-[52px] pt-1 border-t border-border/40 mt-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Apoios: {item.studyBlock.supportMaterials.length} materiais
            </span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[10px] text-accent hover:text-accent/80 font-bold"
              onClick={() => router.push(`/blocks/${item.studyBlockId}?scheduleItemId=${item.id}&returnTo=/`)}
            >
              [Ver apoios]
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {item.studyBlock.supportMaterials.map((support: any) => (
              <div key={support.id} className="text-xs text-muted-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="font-medium truncate max-w-[200px] md:max-w-xs" title={support.material?.fileName}>
                  {support.material?.fileName || "Material"}
                </span>
                {support.pageStart && (
                  <span className="opacity-60 text-[10px]">— págs {support.pageStart}–{support.pageEnd || support.pageStart}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isDone && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pl-0 md:pl-[52px] pt-1 w-full">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            {item.studyBlockId && (
              <Button
                size="sm"
                variant="primary"
                className="w-full sm:w-auto rounded-lg font-bold shadow-sm flex items-center justify-center gap-1.5"
                onClick={() => router.push(`/blocks/${item.studyBlockId}?scheduleItemId=${item.id}&returnTo=/`)}
              >
                <BookOpen className="w-4 h-4" />
                Ver Conteúdo
              </Button>
            )}

            {item.studyBlockId && (
              <>
                {hasFlashcards ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="soft"
                      className="w-full sm:w-auto rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all"
                      onClick={() => router.push(`/practice?blockId=${item.studyBlockId}`)}
                    >
                      <BrainCircuit className="w-3.5 h-3.5" />
                      Praticar Cards ({flashcardCount})
                    </Button>
                    
                    {showGenerateMore && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all border-dashed border-accent/60 text-accent hover:bg-accent/5"
                        onClick={handleGenerateMoreCards}
                        disabled={isGeneratingMore}
                      >
                        {isGeneratingMore ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-accent" />
                        )}
                        <span>{isGeneratingMore ? "Gerando mais..." : "Gerar mais cards"}</span>
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="soft"
                    className="w-full sm:w-auto rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all"
                    onClick={handleGenerateCards}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                    )}
                    <span>{isGenerating ? "Gerando..." : "Gerar Cards (IA)"}</span>
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="w-full md:w-auto rounded-lg font-bold border-accent/50 text-accent hover:bg-accent/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              onClick={handleCompleteStep}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Concluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
