"use client";

import { useState } from "react";
import { ClipboardCheck, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QuestionReviewCard } from "./QuestionReviewCard";

interface QuestionReviewSectionProps {
  initialReviews: any[];
}

export function QuestionReviewSection({ initialReviews }: QuestionReviewSectionProps) {
  const [reviews, setReviews] = useState(initialReviews);

  const handleUpdate = async () => {
    try {
      const res = await fetch("/api/question-reviews");
      if (res.ok) {
        const data = await res.json();
        setReviews(data.tasks || []);
      }
    } catch (err) {
      console.error("Erro ao atualizar revisões por questões:", err);
    }
  };

  if (reviews.length === 0) {
    return (
      <details open className="group space-y-4 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex flex-col gap-1 pb-3 border-b-2 border-sage-light/40 cursor-pointer list-none select-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-5 bg-[#c9ad7f] rounded-full" />
              <ClipboardCheck className="w-4 h-4 text-[#c9ad7f]" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Questões de Revisão</h2>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/80 font-medium">
            Assuntos estudados anteriormente para revisar por questões.
          </p>
        </summary>

        <div className="pt-4 pb-6 flex flex-col items-center justify-center text-center space-y-3 bg-muted/5 rounded-[2rem] border border-dashed border-border/60 p-6 animate-in fade-in duration-300">
          <p className="text-xs text-muted-foreground font-medium">
            Nenhuma revisão por questões disponível hoje.
          </p>
          <button
            onClick={() => window.location.href = "/question-reviews"}
            className="text-[11px] font-bold text-[#c9ad7f] hover:text-[#b0966a] underline underline-offset-4 flex items-center gap-1 transition-colors"
          >
            Configurar revisões para assuntos já estudados →
          </button>
        </div>
      </details>
    );
  }

  return (
    <details open className="group space-y-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex flex-col gap-1 pb-3 border-b-2 border-sage-light/40 cursor-pointer list-none select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 bg-[#c9ad7f] rounded-full" />
            <ClipboardCheck className="w-4 h-4 text-[#c9ad7f]" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Questões de Revisão</h2>
            <Badge variant="outline" className="ml-1 rounded-lg bg-beige/20 text-[#c9ad7f] border-beige/40 font-bold px-2.5 py-0.5 text-[10px]">
              {reviews.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#c9ad7f] uppercase tracking-wider bg-beige/10 px-2.5 py-1 rounded-lg border border-beige/30 hover:bg-beige/20 transition-colors">
            <span className="group-open:hidden">Expandir</span>
            <span className="hidden group-open:inline">Recolher</span>
            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform duration-300" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/80 font-medium">
          Assuntos estudados anteriormente para revisar por questões.
        </p>
      </summary>

      <div className="space-y-4 pt-2 animate-in fade-in duration-300">
        {reviews.map((task) => (
          <QuestionReviewCard 
            key={task.id} 
            task={task} 
            onUpdate={handleUpdate}
          />
        ))}
      </div>
    </details>
  );
}
