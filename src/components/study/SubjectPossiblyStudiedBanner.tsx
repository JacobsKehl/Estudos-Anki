"use client";

import * as React from "react";
import { Sparkles, Info } from "lucide-react";

interface SubjectPossiblyStudiedBannerProps {
  count: number;
}

export function SubjectPossiblyStudiedBanner({ count }: SubjectPossiblyStudiedBannerProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3 text-slate-800 shadow-sm animate-in fade-in duration-300">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-2xl bg-slate-200 text-slate-800 shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5 text-amber-600" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-extrabold leading-tight text-slate-900">
            Seu material principal mudou para os resumos do CFC. {count > 0 ? `${count} blocos podem já ter sido estudados` : "Blocos podem já ter sido estudados"} — confirme para atualizar seu progresso.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed flex items-center gap-1.5 pt-0.5 font-medium">
            <Info className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            <span>
              Os resumos do CFC passaram a ser o seu roteiro principal de leitura. Conforme você confirmar os blocos que já estudou, a sua completude da matéria será atualizada automaticamente.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
