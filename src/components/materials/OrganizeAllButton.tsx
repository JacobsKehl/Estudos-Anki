"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  FileText, 
  BrainCircuit, 
  AlertCircle, 
  RefreshCw, 
  AlertTriangle 
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

interface OrganizeAllButtonProps {
  unorganizedCount: number;
  force?: boolean;
}

type PipelineStep = "idle" | "extracting" | "analyzing" | "blocking" | "flashcards" | "done" | "error";

const STEP_LABELS: Record<PipelineStep, string> = {
  idle: "Organizar meus estudos",
  extracting: "Extraindo texto...",
  analyzing: "Identificando matéria...",
  blocking: "Criando blocos...",
  flashcards: "Gerando flashcards...",
  done: "Concluído!",
  error: "Erro na organização",
};

export function OrganizeAllButton({ unorganizedCount, force = false }: OrganizeAllButtonProps) {
  const [step, setStep] = useState<PipelineStep>("idle");
  const [processed, setProcessed] = useState(0);
  const [totalFlashcards, setTotalFlashcards] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [currentPdfIndex, setCurrentPdfIndex] = useState(0);
  const router = useRouter();

  const isLoading = step !== "idle" && step !== "done" && step !== "error";
  const isSuccess = step === "done";

  const handleButtonClick = () => {
    if (force) {
      setShowConfirmModal(true);
    } else {
      handleOrganize();
    }
  };

  const handleOrganize = async () => {
    if (!force && unorganizedCount === 0) {
      toast.info("Tudo organizado! Seus PDFs já foram analisados.");
      return;
    }

    setStep("extracting");
    setProcessed(0);
    setTotalFlashcards(0);
    setCurrentPdfIndex(0);

    let totalProcessed = 0;
    let totalCards = 0;
    let totalBlocks = 0;
    let totalErrors = 0;
    let totalSubjectsCreated = 0;

    let materialIds: string[] = [];
    let localTotalToProcess = force ? 0 : unorganizedCount;

    // 1. Etapa de Reset Inicial ou Busca de IDs Pendentes
    if (force) {
      const resetToastId = "reorganize-reset";
      toast.loading("Limpando organização anterior...", { id: resetToastId });

      try {
        const res = await fetch("/api/materials/organize-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reset: true }),
        });
        const data = await res.json();
        
        if (!res.ok) {
          toast.error(`Erro ao limpar materiais: ${data.error || "Falha técnica"}`, { id: resetToastId });
          setStep("error");
          setTimeout(() => setStep("idle"), 3000);
          return;
        }

        materialIds = data.materialIds || [];
        localTotalToProcess = data.count || 0;
        setTotalToProcess(localTotalToProcess);

        if (localTotalToProcess === 0) {
          toast.info("Nenhum material importado encontrado para reorganizar.", { id: resetToastId });
          setStep("idle");
          return;
        }
        toast.success("Limpeza concluída! Iniciando reorganização...", { id: resetToastId, duration: 2000 });
      } catch (err) {
        toast.error("Erro de rede ao limpar materiais.", { id: resetToastId });
        setStep("error");
        setTimeout(() => setStep("idle"), 3000);
        return;
      }
    } else {
      // Obter os IDs pendentes para permitir o polling correto de progresso
      try {
        const res = await fetch("/api/materials/organize-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ getPendingIds: true }),
        });
        const data = await res.json();
        if (res.ok) {
          materialIds = data.materialIds || [];
          localTotalToProcess = data.count || 0;
          setTotalToProcess(localTotalToProcess);
        }
      } catch (err) {
        console.error("Erro ao obter IDs pendentes:", err);
      }
    }

    // 2. Loop de Processamento Seguro (Material por Material)
    for (let i = 0; i < localTotalToProcess; i++) {
      const toastId = `organize-${i}`;
      const pdfNum = i + 1;
      const currentMaterialId = materialIds[i];
      setCurrentPdfIndex(pdfNum);

      let pollInterval: any = null;

      try {
        setStep("extracting");
        toast.loading(
          `PDF ${pdfNum} de ${localTotalToProcess}: Extraindo texto...`,
          { id: toastId }
        );

        // Polling de status real a cada 1.5 segundos
        if (currentMaterialId) {
          let lastStatus = "IMPORTED";
          pollInterval = setInterval(async () => {
            try {
              const pollRes = await fetch(`/api/materials/${currentMaterialId}`);
              if (pollRes.ok) {
                const pollData = await pollRes.json();
                const status = pollData.organizationStatus;
                
                if (status && status !== lastStatus) {
                  lastStatus = status;
                  
                  let label = `PDF ${pdfNum} de ${localTotalToProcess}: Extraindo texto...`;
                  if (status === "ANALYZING") {
                    setStep("analyzing");
                    label = `PDF ${pdfNum} de ${localTotalToProcess}: Identificando matéria...`;
                  } else if (status === "ORGANIZING") {
                    setStep("blocking");
                    label = `PDF ${pdfNum} de ${localTotalToProcess}: Criando blocos de estudo...`;
                  } else if (status === "GENERATING_FLASHCARDS") {
                    setStep("flashcards");
                    label = `PDF ${pdfNum} de ${localTotalToProcess}: Gerando flashcards com IA...`;
                  } else if (status === "ORGANIZED") {
                    setStep("done");
                    label = `PDF ${pdfNum} de ${localTotalToProcess}: Concluído!`;
                  }
                  
                  toast.loading(label, { id: toastId });
                }
              }
            } catch (pollErr) {
              console.error("Erro no polling de status:", pollErr);
            }
          }, 1500);
        }

        const res = await fetch("/api/materials/organize-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            force,
            ...(currentMaterialId ? { materialId: currentMaterialId } : {})
          }),
        });

        if (pollInterval) {
          clearInterval(pollInterval);
        }

        const data = await res.json();

        if (!res.ok) {
          totalErrors++;
          toast.error(
            `PDF ${pdfNum} de ${localTotalToProcess}: ${data.error || "Falha técnica"}`,
            { id: toastId, duration: 4000 }
          );
          continue;
        }

        if (!force && data.count === 0) {
          toast.dismiss(toastId);
          break;
        }

        const r = data.results;
        if (r?.success > 0) {
          totalProcessed += r.success;
          totalCards += r.totalFlashcards ?? 0;
          totalBlocks += r.totalBlocks ?? 0;
          if (r.subjectsCreated > 0) {
            totalSubjectsCreated += r.subjectsCreated;
          }
          setProcessed(p => p + r.success);
          setTotalFlashcards(c => c + (r.totalFlashcards ?? 0));
          setStep("done");
          
          toast.success(
            `PDF ${pdfNum} de ${localTotalToProcess}: ${r.totalBlocks} blocos · ${r.totalFlashcards} cards`,
            { id: toastId, duration: 3000 }
          );
        } else if (r?.errors > 0) {
          totalErrors += r.errors;
          toast.warning(
            `PDF ${pdfNum} de ${localTotalToProcess}: ${data.message || "Não organizado"}`,
            { id: toastId, duration: 4000 }
          );
        }

      } catch (err: any) {
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        totalErrors++;
        toast.error(
          `PDF ${pdfNum} de ${localTotalToProcess}: Erro no servidor`,
          { id: toastId, duration: 4000 }
        );
      }

      // Pequeno cooldown de 2 segundos entre arquivos para mitigar picos de requisições no Gemini
      if (i < localTotalToProcess - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 3. Resumo Final Detalhado e Geração Consolidada de Cronograma
    if (totalProcessed > 0) {
      setStep("done");
      
      const scheduleToastId = "schedule-generation";
      toast.loading("Atualizando seu cronograma inteligente de estudos...", { id: scheduleToastId });

      try {
        await fetch("/api/schedule/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Meu Cronograma de Estudos",
            dailyMinutes: 120,
            daysAhead: 30
          })
        });
        toast.success("Cronograma inteligente atualizado!", { id: scheduleToastId, duration: 3000 });
      } catch (schedErr) {
        console.error("Erro ao gerar cronograma final:", schedErr);
        toast.dismiss(scheduleToastId);
      }
      
      const summaryMessage = force ? (
        <div className="space-y-1.5 py-1 text-card-foreground">
          <p className="font-bold text-sm text-foreground">Reorganização concluída.</p>
          <div className="text-xs space-y-1 opacity-90">
            <p>• PDFs reprocessados: {totalProcessed}</p>
            <p>• Matérias criadas/vinculadas: {totalSubjectsCreated || totalProcessed}</p>
            <p>• Blocos criados: {totalBlocks}</p>
            <p>• Cronograma recriado: Sim</p>
            {totalErrors > 0 && (
              <p className="text-[10px] text-amber-500 font-bold mt-1">
                ⚠️ {totalErrors} erro(s) durante o processo.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1 py-1">
          <p className="font-bold text-sm">Organização concluída!</p>
          <div className="text-xs space-y-0.5 opacity-90">
            <p>• PDFs processados: {totalProcessed + totalErrors}</p>
            <p>• Blocos criados: {totalBlocks}</p>
            <p>• Flashcards gerados: {totalCards}</p>
            <p>• Limite aplicado: máximo de 15 por bloco</p>
            <p>• Cards aguardando aprovação: {totalCards}</p>
            <p>• Cronograma atualizado: Sim</p>
          </div>
          {totalErrors > 0 && (
            <p className="text-[10px] text-amber-500 font-bold mt-1">
              ⚠️ {totalErrors} PDF(s) apresentaram erros.
            </p>
          )}
        </div>
      );
      toast.success(summaryMessage, { duration: 10000 });
      router.refresh();
      setTimeout(() => setStep("idle"), 10000);
    } else if (totalErrors > 0) {
      setStep("error");
      toast.error("A organização falhou para os materiais selecionados.", { duration: 5000 });
      setTimeout(() => setStep("idle"), 3000);
      router.refresh();
    } else {
      setStep("idle");
    }
  };

  if (!force && unorganizedCount === 0) {
    return (
      <Button
        variant="outline"
        size="lg"
        className="rounded-2xl border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10 cursor-default"
        disabled
      >
        <CheckCircle2 className="w-5 h-5 mr-2" />
        Tudo Organizado
      </Button>
    );
  }

  const getLoadingLabel = () => {
    const label = STEP_LABELS[step];
    if (force && totalToProcess > 0) {
      return `PDF ${currentPdfIndex} de ${totalToProcess}: ${label}`;
    }
    return label;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="primary"
        size="lg"
        className="rounded-2xl font-bold transition-transform hover:scale-[1.02]"
        disabled={isLoading || isSuccess}
        onClick={handleButtonClick}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            {getLoadingLabel()}
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle2 className="w-5 h-5 mr-3" />
            Sucesso!
          </>
        ) : (
          <>
            {force ? <RefreshCw className="w-5 h-5 mr-3" /> : <Sparkles className="w-5 h-5 mr-3" />}
            {force ? "Reorganizar meus estudos" : `Organizar meus estudos (${unorganizedCount})`}
          </>
        )}
      </Button>

      {isLoading && processed > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground animate-pulse">
          <FileText className="w-3.5 h-3.5" />
          <span>{processed} PDF(s) concluído(s)</span>
          {totalFlashcards > 0 && (
            <>
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>{totalFlashcards} cards gerados</span>
            </>
          )}
        </div>
      )}

      {/* Modal de Confirmação Forte para Reorganização */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md bg-card border border-border/80 shadow-2xl rounded-[2rem] p-6">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2.5 text-amber-600">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
              Atenção: reorganização completa
            </DialogTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Esta ação apagará toda a organização atual dos seus estudos, incluindo blocos, cronograma, flashcards, histórico de revisões e progresso registrado.
            </p>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm font-semibold text-foreground">
              Seus PDFs importados serão mantidos, mas todo o planejamento será reconstruído do zero.
            </p>
            <p className="text-sm mt-3 font-bold text-foreground">
              Deseja continuar?
            </p>
          </div>
          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="md"
              className="font-bold flex-grow sm:flex-grow-0"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="md"
              className="font-bold flex-grow"
              onClick={() => {
                setShowConfirmModal(false);
                handleOrganize();
              }}
            >
              Reorganizar tudo do zero
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

