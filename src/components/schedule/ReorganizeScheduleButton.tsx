"use client";

import { useState } from "react";
import { RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ReorganizeScheduleButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const router = useRouter();

  const handleReorganize = async () => {
    setIsLoading(true);
    
    // Sequential progress steps
    setLoadingStep("Reorganizando cronograma...");
    await new Promise((r) => setTimeout(r, 650));
    setLoadingStep("Analisando blocos pendentes...");
    await new Promise((r) => setTimeout(r, 700));
    setLoadingStep("Distribuindo próximos dias...");
    await new Promise((r) => setTimeout(r, 700));
    setLoadingStep("Atualizando roteiro...");
    await new Promise((r) => setTimeout(r, 500));

    try {
      const res = await fetch("/api/schedule/reorganize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Não conseguimos reorganizar o cronograma agora.");
      }

      toast.success("Cronograma reorganizado com sucesso!");
      setIsOpen(false);
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.message || "Não conseguimos reorganizar o cronograma agora. Tente novamente em instantes."
      );
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <>
      <Button
        variant="soft"
        size="md"
        onClick={() => setIsOpen(true)}
        className="rounded-xl font-bold gap-2 active:scale-95 shrink-0"
      >
        <RefreshCw className="w-4 h-4" />
        Reorganizar Cronograma
      </Button>

      {/* Reorganize Confirmation Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => !isLoading && setIsOpen(open)}>
        <DialogContent className="max-w-md bg-card border border-border/80 shadow-2xl rounded-[2rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              Reorganizar seu Roteiro de Estudos?
            </DialogTitle>
            
            <div className="text-muted-foreground text-sm space-y-4 mt-4">
              <div className="p-4 bg-amber-500/[0.03] border border-amber-500/10 rounded-2xl space-y-3">
                <p className="font-bold text-amber-700 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Atenção
                </p>
                <p className="text-xs text-amber-900/90 leading-relaxed font-medium">
                  Ao reorganizar o cronograma, o Kehl irá recalcular os próximos dias de estudo com base nos blocos pendentes, matérias prioritárias e progresso atual.
                </p>
              </div>

              {/* Guarantees List */}
              <div className="space-y-2.5 pl-1 pt-1">
                <div className="flex gap-2.5 items-start text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Tarefas já concluídas serão <strong>preservadas</strong>.</span>
                </div>
                <div className="flex gap-2.5 items-start text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Cards respondidos e histórico SRS <strong>não serão alterados</strong>.</span>
                </div>
                <div className="flex gap-2.5 items-start text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Apenas itens futuros não concluídos poderão ser substituídos.</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Dialog Footer Actions / Loading Progress */}
          <DialogFooter className="mt-8 pt-4 border-t border-border/40 flex flex-col sm:flex-row gap-3">
            {isLoading ? (
              <div className="w-full py-2 flex flex-col items-center justify-center gap-3 animate-pulse">
                <div className="flex items-center gap-2 text-xs font-bold text-accent">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span>{loadingStep}</span>
                </div>
                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                  <div className="bg-accent h-full w-2/3 animate-[shimmer_1.5s_infinite] rounded-full" />
                </div>
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl h-10 px-4 font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleReorganize}
                  variant="primary"
                  size="md"
                  className="rounded-xl font-bold active:scale-95 transition-all"
                >
                  Reorganizar cronograma
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
