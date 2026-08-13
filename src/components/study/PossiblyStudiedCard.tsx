"use client";

import * as React from "react";
import { Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PossiblyStudiedCardProps {
  blockId: string;
  sourceV1Title?: string | null;
  totalV2TopicsCovered?: number | null;
  currentOfficialTopicId?: string | null;
  onActionComplete?: () => void;
}

export function PossiblyStudiedCard({
  blockId,
  sourceV1Title,
  onActionComplete,
}: PossiblyStudiedCardProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = React.useState<"CONFIRM" | "DISMISS" | null>(null);

  const handleAction = async (action: "CONFIRM" | "DISMISS") => {
    setLoadingAction(action);
    const toastId = toast.loading(
      action === "CONFIRM" ? "Marcando bloco como já estudado..." : "Mantendo bloco como pendente..."
    );

    try {
      const res = await fetch(`/api/blocks/${blockId}/confirm-studied`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error("Erro ao processar confirmação");

      toast.success(
        action === "CONFIRM"
          ? "🎉 Bloco confirmado como concluído! Seu progresso foi atualizado."
          : "Bloco mantido para leitura no seu cronograma.",
        { id: toastId }
      );

      if (onActionComplete) onActionComplete();
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao atualizar bloco", { id: toastId });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-3xl p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Pré-crédito Encontrado
            </span>
          </div>
          <h4 className="text-base font-bold text-foreground">
            Você provavelmente já estudou isto.
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Este tópico foi coberto pelo bloco <strong className="text-foreground font-semibold">"{sourceV1Title || "Material Estratégia"}"</strong> do Estratégia, que você concluiu.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-amber-500/20">
        <Button
          size="sm"
          onClick={() => handleAction("CONFIRM")}
          disabled={loadingAction !== null}
          className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2 text-xs h-10 px-5"
        >
          {loadingAction === "CONFIRM" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          Já estudei
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction("DISMISS")}
          disabled={loadingAction !== null}
          className="rounded-xl font-bold border-amber-500/30 text-amber-900 dark:text-amber-200 hover:bg-amber-500/10 gap-2 text-xs h-10 px-5"
        >
          {loadingAction === "DISMISS" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          Ainda não
        </Button>
      </div>
    </div>
  );
}
