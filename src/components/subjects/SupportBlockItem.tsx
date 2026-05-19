"use client";

import * as React from "react";
import { FileText, ArrowRight, Sparkles, Layers, Clock, BookOpen, CheckCircle2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// Definindo o mapeamento de ícones e estilos para os diferentes tipos de apoio
const SUPPORT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: any; bgClass: string; textClass: string; borderClass: string }
> = {
  SUMMARY: {
    label: "Resumo Teórico",
    icon: FileText,
    bgClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    textClass: "text-emerald-700 dark:text-emerald-400",
    borderClass: "border-emerald-200/50 dark:border-emerald-800/30"
  },
  BIZU: {
    label: "Bizu / Dica Rápida",
    icon: Sparkles,
    bgClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    textClass: "text-amber-700 dark:text-amber-400",
    borderClass: "border-amber-200/50 dark:border-amber-800/30"
  },
  MIND_MAP: {
    label: "Mapa Mental",
    icon: Layers,
    bgClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
    textClass: "text-sky-700 dark:text-sky-400",
    borderClass: "border-sky-200/50 dark:border-sky-800/30"
  },
  CHECKLIST: {
    label: "Checklist",
    icon: FileText,
    bgClass: "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400",
    textClass: "text-teal-700 dark:text-teal-400",
    borderClass: "border-teal-200/50 dark:border-teal-800/30"
  },
  REVIEW: {
    label: "Revisão Rápida",
    icon: Clock,
    bgClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
    textClass: "text-rose-700 dark:text-rose-400",
    borderClass: "border-rose-200/50 dark:border-rose-800/30"
  },
  QUESTIONS: {
    label: "Questões Práticas",
    icon: BookOpen,
    bgClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    textClass: "text-blue-700 dark:text-blue-400",
    borderClass: "border-blue-200/50 dark:border-blue-800/30"
  },
  COMMENTED_QUESTIONS: {
    label: "Questões Comentadas",
    icon: BookOpen,
    bgClass: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400",
    textClass: "text-cyan-700 dark:text-cyan-400",
    borderClass: "border-cyan-200/50 dark:border-cyan-800/30"
  },
  SIMULATED_EXAM: {
    label: "Simulado de Prova",
    icon: BookOpen,
    bgClass: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
    textClass: "text-orange-700 dark:text-orange-400",
    borderClass: "border-orange-200/50 dark:border-orange-800/30"
  },
  ANSWER_KEY: {
    label: "Gabarito de Conferência",
    icon: CheckCircle2,
    bgClass: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    textClass: "text-green-700 dark:text-green-400",
    borderClass: "border-green-200/50 dark:border-green-800/30"
  },
  OTHER: {
    label: "Material de Apoio",
    icon: FileText,
    bgClass: "bg-slate-50 text-slate-700 dark:bg-slate-950/30 dark:text-slate-400",
    textClass: "text-slate-700 dark:text-slate-400",
    borderClass: "border-slate-200/50 dark:border-slate-800/30"
  }
};

interface SupportBlockItemProps {
  support: {
    id: string;
    studyBlockId: string;
    materialId: string;
    pageStart: number | null;
    pageEnd: number | null;
    supportType: string | null;
    material: {
      fileName: string;
    };
    studyBlock: {
      title: string;
    };
  };
}

export function SupportBlockItem({ support }: SupportBlockItemProps) {
  const router = useRouter();
  const typeConfig = SUPPORT_TYPE_CONFIG[support.supportType || "OTHER"] || SUPPORT_TYPE_CONFIG.OTHER;
  const TypeIcon = typeConfig.icon;

  const handleCardClick = () => {
    router.push(`/blocks/${support.studyBlockId}?tab=apoios`);
  };

  return (
    <div 
      onClick={handleCardClick}
      className="group bg-card p-5 rounded-[2rem] border border-border/40 flex flex-col gap-3 hover:border-accent/30 transition-all shadow-[0_4px_12px_-4px_rgba(0,0,0,0.02)] cursor-pointer relative"
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${typeConfig.bgClass} border border-transparent flex items-center gap-1.5`}>
              <TypeIcon className="w-3 h-3 text-current shrink-0" />
              {typeConfig.label}
            </span>
            {support.pageStart && (
              <span className="text-xs font-semibold text-accent/80 bg-accent/5 px-3 py-1 rounded-full">
                Págs {support.pageStart} a {support.pageEnd || support.pageStart}
              </span>
            )}
          </div>
          <h3 className="font-bold text-base leading-tight text-foreground group-hover:text-accent transition-colors pt-1">
            {support.material.fileName}
          </h3>
        </div>

        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-1 group-hover:translate-x-0">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-accent/5 hover:bg-accent hover:text-white transition-all"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-3 border-t border-border/30 mt-1">
        <LinkIcon className="w-3.5 h-3.5 text-accent/60" />
        <span className="font-medium text-[11px] truncate max-w-[90%]">
          Vinculado ao bloco teórico:{" "}
          <span 
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/blocks/${support.studyBlockId}`);
            }}
            className="font-bold text-foreground hover:text-accent transition-colors underline decoration-border/60 hover:decoration-accent/60"
          >
            {support.studyBlock.title}
          </span>
        </span>
      </div>
    </div>
  );
}
