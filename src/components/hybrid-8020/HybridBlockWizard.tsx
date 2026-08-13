"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface HybridBlockWizardProps {
  subjectId: string;
  cfcMaterials: Array<{ id: string; fileName: string; provider: string; totalPages: number | null }>;
  estrategiaMaterials: Array<{ id: string; fileName: string; provider: string; totalPages: number | null }>;
}

export function HybridBlockWizard({ subjectId, cfcMaterials, estrategiaMaterials }: HybridBlockWizardProps) {
  return (
    <div className="p-6 bg-card rounded-2xl border border-border/80 space-y-4">
      <h2 className="text-lg font-bold text-foreground">Assistente de Bloco Híbrido 80/20</h2>
      <p className="text-xs text-muted-foreground">
        Materiais CFC disponíveis: {cfcMaterials.length} | Estratégia disponíveis: {estrategiaMaterials.length}
      </p>
    </div>
  );
}
