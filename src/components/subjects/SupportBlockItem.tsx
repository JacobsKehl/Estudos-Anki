"use client";

import * as React from "react";
import { FileText, ArrowRight, Sparkles, Layers, Clock, BookOpen, CheckCircle2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";

// Definindo o mapeamento de ícones e estilos para os diferentes tipos de apoio
const SUPPORT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: any; bgClass: string; textClass: string; borderClass: string }
> = {
  SUMMARY: {
    label: "Resumo Teórico",
    icon: FileText,
    bgClass: "bg-accent/10 text-accent",
    textClass: "text-accent",
    borderClass: "border-accent/20"
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
    bgClass: "bg-accent/15 text-accent",
    textClass: "text-accent",
    borderClass: "border-accent/25"
  },
  CHECKLIST: {
    label: "Checklist",
    icon: FileText,
    bgClass: "bg-sage-light/30 text-accent",
    textClass: "text-accent",
    borderClass: "border-accent/20"
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
    bgClass: "bg-muted/60 text-foreground",
    textClass: "text-foreground",
    borderClass: "border-border/50"
  },
  COMMENTED_QUESTIONS: {
    label: "Questões Comentadas",
    icon: BookOpen,
    bgClass: "bg-muted/60 text-foreground",
    textClass: "text-foreground",
    borderClass: "border-border/50"
  },
  SIMULATED_EXAM: {
    label: "Simulado de Prova",
    icon: BookOpen,
    bgClass: "bg-amber-50/70 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    textClass: "text-amber-700 dark:text-amber-400",
    borderClass: "border-amber-200/50 dark:border-amber-800/30"
  },
  ANSWER_KEY: {
    label: "Gabarito de Conferência",
    icon: CheckCircle2,
    bgClass: "bg-accent/10 text-accent",
    textClass: "text-accent",
    borderClass: "border-accent/20"
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
  const pathname = usePathname();
  const typeConfig = SUPPORT_TYPE_CONFIG[support.supportType || "OTHER"] || SUPPORT_TYPE_CONFIG.OTHER;
  const TypeIcon = typeConfig.icon;

  const handleCardClick = () => {
    router.push(`/blocks/${support.studyBlockId}?tab=apoios&returnTo=${encodeURIComponent(pathname)}`);
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
              router.push(`/blocks/${support.studyBlockId}?returnTo=${encodeURIComponent(pathname)}`);
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
