"use client";

import { BookOpen, Settings } from "lucide-react";
import Link from "next/link";

export function WeeklyReviewEmptyState() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-16">
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-10 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-sage-light/50 flex items-center justify-center mx-auto">
          <BookOpen className="w-8 h-8 text-accent" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">
            Revisão Semanal Desativada
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A revisão semanal permite consolidar seu aprendizado revisando
            os principais assuntos estudados durante a semana.
          </p>
        </div>

        <Link
          href="/settings#revisao-semanal"
          className="inline-flex items-center gap-2 px-6 h-12 rounded-xl bg-accent text-accent-foreground text-sm font-bold shadow-sm hover:scale-[1.01] transition-transform"
        >
          <Settings className="w-4 h-4" />
          Ativar nas Configurações
        </Link>
      </div>
    </div>
  );
}
