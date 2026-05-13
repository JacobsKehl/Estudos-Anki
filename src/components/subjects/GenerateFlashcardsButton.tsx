"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Loader2, Check, Sparkles, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

interface GenerateFlashcardsButtonProps {
  blockId: string;
  hasFlashcards?: boolean;
}

export function GenerateFlashcardsButton({ blockId, hasFlashcards }: GenerateFlashcardsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsLoading(true);
    const toastId = toast.loading("Gerando flashcards com IA...");
    
    try {
      const response = await fetch(`/api/blocks/${blockId}/flashcards/generate`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao gerar flashcards");
      }

      toast.success(data.message || "Flashcards gerados com sucesso!", { id: toastId });
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao gerar flashcards. Tente novamente.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  if (hasFlashcards && !isLoading) {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-8 text-xs gap-1.5 hover:bg-accent/5 border-accent/20 text-accent"
          onClick={handleGenerate}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Gerar mais
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-xl h-8 text-xs gap-1.5 bg-accent text-white hover:bg-accent/90"
          asChild
        >
          <Link href={`/flashcards?blockId=${blockId}`}>
            <ExternalLink className="w-3.5 h-3.5" />
            Ver Cards
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="rounded-xl h-9 px-4 gap-2 font-medium hover:border-accent/50 hover:bg-accent/5"
      onClick={handleGenerate}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          <span className="text-accent">Analisando bloco...</span>
        </>
      ) : (
        <>
          <BrainCircuit className="w-4 h-4 text-accent" />
          Gerar Flashcards
        </>
      )}
    </Button>
  );
}
