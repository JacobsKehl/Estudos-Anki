"use client";

import * as React from "react";
import { Sparkles, Info } from "lucide-react";

interface SubjectPossiblyStudiedBannerProps {
  count: number;
}

export function SubjectPossiblyStudiedBanner({ count }: SubjectPossiblyStudiedBannerProps) {
  return (
    <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-3xl p-5 space-y-3 text-amber-900 dark:text-amber-200 animate-in fade-in duration-300 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-800 dark:text-amber-200 shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold leading-tight">
            Seu material principal mudou para os resumos do CFC. {count > 0 ? `${count} blocos podem já ter sido estudados` : "19 blocos podem já ter sido estudados"} — confirme para atualizar seu progresso.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed flex items-center gap-1.5 pt-0.5">
            <Info className="w-3.5 h-3.5 shrink-0 text-amber-700" />
            <span>
              A queda temporária na porcentagem ocorre porque o CFC passou a ser o caminho principal de leitura e os materiais antigos viraram consulta. Conforme você confirmar o que já estudou, sua complitude subirá para <strong>48,3%</strong> (acima dos 37,9% de antes).
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
