import * as React from "react";
import { AlertTriangle } from "lucide-react";

interface GapNoteSectionProps {
  gapNote?: {
    status: "READY" | "NOT_REQUIRED" | "FAILED";
    gapItems?: string[] | any;
  } | null;
}

export function GapNoteSection({ gapNote }: GapNoteSectionProps) {
  if (!gapNote) return null;

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 space-y-4 my-6 text-left">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-base">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        <h3>O que o CFC não cobre</h3>
      </div>

      {gapNote.status === "NOT_REQUIRED" ? (
        <p className="text-sm text-muted-foreground font-medium">
          Sem material de consulta do Estratégia para este tópico — o resumo do CFC é sua fonte principal.
        </p>
      ) : gapNote.status === "READY" && Array.isArray(gapNote.gapItems) && gapNote.gapItems.length > 0 ? (
        <ul className="space-y-2.5">
          {(gapNote.gapItems as string[]).map((item: string, idx: number) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm text-foreground/90 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
