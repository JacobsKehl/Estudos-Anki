"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface GenerateAllFlashcardsButtonProps {
  subjectId: string;
}

export function GenerateAllFlashcardsButton({ subjectId }: GenerateAllFlashcardsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleGenerateAll = async () => {
    setIsLoading(true);
    let stats: { totalBlocks: number; blocksWithoutCards: number; existingApprovedCards: number } | null = null;
    
    try {
      const statsRes = await fetch(`/api/subjects/${subjectId}/generate-all-flashcards`);
      if (statsRes.ok) {
        stats = await statsRes.json();
      }
    } catch {
      // Ignore preflight fetch error
    }

    if (stats) {
      if (stats.blocksWithoutCards === 0) {
        toast.info(`Esta matéria possui ${stats.totalBlocks} blocos e todos os ${stats.existingApprovedCards} flashcards já estão ativos. Nenhum novo card precisa ser gerado.`);
        setIsLoading(false);
        return;
      }

      const confirmMsg = `Esta matéria possui ${stats.totalBlocks} blocos no total e ${stats.existingApprovedCards} flashcards aprovados.\n\nSerão gerados novos flashcards APENAS para os ${stats.blocksWithoutCards} blocos que ainda NÃO possuem cards.\n\nDeseja continuar?`;
      if (!window.confirm(confirmMsg)) {
        setIsLoading(false);
        return;
      }
    } else {
      if (!window.confirm("Isso irá gerar flashcards APENAS para blocos que ainda não possuem cards. Deseja continuar?")) {
        setIsLoading(false);
        return;
      }
    }

    const toastId = toast.loading("Analisando blocos sem cards e gerando com IA...");
    
    try {
      const response = await fetch(`/api/subjects/${subjectId}/generate-all-flashcards`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao gerar flashcards em massa");
      }

      if (data.count > 0) {
        toast.success(data.message, { id: toastId, duration: 5000 });
      } else {
        toast.info(data.message, { id: toastId });
      }
      
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao gerar flashcards em massa.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="rounded-xl gap-2 font-medium bg-accent/5 border-accent/20 text-accent hover:bg-accent/10"
      onClick={handleGenerateAll}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <BrainCircuit className="w-4 h-4" />
      )}
      {isLoading ? "Gerando de tudo..." : "Gerar todos Flashcards com IA"}
    </Button>
  );
}
