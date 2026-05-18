"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wrench, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function RepairSupportsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRepair = async () => {
    setIsLoading(true);
    const toastId = toast.loading("Analisando PDFs organizados em busca de questões e gabaritos...");

    try {
      const res = await fetch("/api/materials/repair-supports", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro na varredura retroativa");
      }

      if (data.results?.migratedCount > 0) {
        const list = data.results.details
          .map((d: any) => `• ${d.fileName} (${d.detectedType === "ANSWER_KEY" ? "Gabarito" : "Questões"})`)
          .join("\n");

        toast.success(
          <div className="space-y-1.5 py-1 text-card-foreground">
            <p className="font-bold text-sm text-foreground">Varredura Concluída!</p>
            <p className="text-xs">{data.message}</p>
            <div className="text-[10px] opacity-80 max-h-32 overflow-y-auto whitespace-pre-line border-t border-border/20 pt-1.5 mt-1">
              {list}
            </div>
          </div>,
          { id: toastId, duration: 12000 }
        );
      } else {
        toast.success("Varredura concluída! Nenhum material de apoio pendente ou oculto foi encontrado.", {
          id: toastId,
          duration: 5000
        });
      }

      router.refresh();

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro de rede ao processar varredura.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-xl font-semibold gap-2 border-accent/20 text-accent hover:bg-accent/5 transition-all text-xs"
      disabled={isLoading}
      onClick={handleRepair}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Corrigindo apoios...
        </>
      ) : (
        <>
          <Wrench className="w-3.5 h-3.5" />
          Varredura Retroativa (Filtro de Apoios)
        </>
      )}
    </Button>
  );
}
