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
    const confirm = window.confirm(
      "Isso irá gerar flashcards para TODOS os blocos de estudo desta matéria que ainda não possuem cards. Deseja continuar?"
    );
    
    if (!confirm) return;

    setIsLoading(true);
    const toastId = toast.loading("Analisando todos os blocos e gerando cards...");
    
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
