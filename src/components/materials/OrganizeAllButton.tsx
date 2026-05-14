"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle2, FileText, BrainCircuit, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const isLoading = step !== "idle" && step !== "done" && step !== "error";
  const isSuccess = step === "done";

  const handleOrganize = async () => {
    if (!force && unorganizedCount === 0) {
      toast.info("Tudo organizado! Seus PDFs já foram analisados.");
      return;
    }

    if (force && !confirm("Isso irá apagar os blocos e cards atuais para re-organizar tudo com IA. Deseja continuar?")) {
      return;
    }

    setStep("extracting");
    setProcessed(0);
    setTotalFlashcards(0);

    let totalProcessed = 0;
    let totalCards = 0;
    let totalBlocks = 0;
    let totalErrors = 0;
    // No modo force, processamos todos os materiais (um por um via API)
    const totalToProcess = force ? 999 : unorganizedCount; 

    for (let i = 0; i < totalToProcess; i++) {
      const toastId = `organize-${i}`;
      const pdfNum = i + 1;

      try {
        setStep("extracting");
        toast.loading(force ? `Reorganizando PDF ${pdfNum}...` : `PDF ${pdfNum}/${totalToProcess}: Processando...`, { id: toastId });

        const res = await fetch("/api/materials/organize-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        });
        const data = await res.json();

        if (!res.ok) {
          totalErrors++;
          toast.error(`PDF ${pdfNum}: ${data.error || "Falha técnica"}`, { id: toastId, duration: 4000 });
          continue;
        }

        if (data.count === 0) {
          toast.dismiss(toastId);
          break;
        }

        const r = data.results;
        if (r?.success > 0) {
          totalProcessed += r.success;
          totalCards += r.totalFlashcards ?? 0;
          totalBlocks += r.totalBlocks ?? 0;
          setProcessed(p => p + r.success);
          setTotalFlashcards(c => c + (r.totalFlashcards ?? 0));
          setStep("flashcards");
          toast.success(
            `PDF ${pdfNum}: ${r.totalBlocks} blocos · ${r.totalFlashcards} cards`,
            { id: toastId, duration: 3000 }
          );
        } else if (r?.errors > 0) {
          totalErrors += r.errors;
          toast.warning(`PDF ${pdfNum}: ${data.message || "Não organizado"}`, { id: toastId, duration: 4000 });
        }

      } catch (err: any) {
        totalErrors++;
        toast.error(`PDF ${pdfNum}: Erro de rede`, { id: `err-${i}`, duration: 4000 });
      }
    }

    // Resumo Final Detalhado
    if (totalProcessed > 0) {
      setStep("done");
      
      const summaryMessage = (
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
        className="rounded-2xl h-14 px-8 border-emerald-200 text-emerald-700 bg-emerald-50/50 cursor-default"
        disabled
      >
        <CheckCircle2 className="w-5 h-5 mr-2" />
        Tudo Organizado
      </Button>
    );
  }

  const currentLabel = STEP_LABELS[step];

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        className="rounded-2xl h-14 px-10 bg-accent text-white hover:bg-accent/90 shadow-xl shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98] font-bold text-lg"
        disabled={isLoading || isSuccess}
        onClick={handleOrganize}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            {currentLabel}
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
    </div>
  );
}
