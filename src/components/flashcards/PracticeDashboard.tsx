"use client";

import { useState } from "react";
import { Play, Sparkles, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashcardSession } from "@/components/flashcards/FlashcardSession";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/brand/BrandLockup";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export function PracticeDashboard({ cards }: { cards: any[] }) {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const router = useRouter();

  if (isSessionActive) {
    return (
      <FlashcardSession 
        mode="practice"
        title="Cards do Dia"
        cards={cards} 
        onComplete={() => {
          setIsSessionActive(false);
          router.refresh();
        }} 
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <PageHeader 
        icon={Sparkles}
        title="Prática do Dia"
        description="Aplique os conceitos logo após estudá-los."
      />

      <div className="bg-accent/5 border border-accent/10 rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
        <div className="flex-1 space-y-4 text-center md:text-left">
          {cards.length > 0 ? (
            <>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Pronto para testar seus conhecimentos?</h2>
              <p className="text-muted-foreground text-base md:text-lg max-w-md">
                Temos {cards.length} cards relacionados aos conteúdos de hoje. 
                Sua resposta calibrará o algoritmo para as revisões futuras.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-2 justify-center md:justify-start">
                <Button 
                  size="lg" 
                  className="rounded-2xl h-12 md:h-14 px-8 gap-2 shadow-lg shadow-accent/20 w-full sm:w-auto"
                  onClick={() => setIsSessionActive(true)}
                >
                  <Play className="w-5 h-5 fill-current" />
                  Iniciar Prática
                </Button>
                <Button variant="outline" size="lg" className="rounded-2xl h-12 md:h-14 px-8 gap-2 border-accent/20 text-accent w-full sm:w-auto" asChild>
                  <Link href="/">
                    <LayoutDashboard className="w-5 h-5" />
                    Voltar para o Início
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Nenhum card disponível</h2>
              <p className="text-muted-foreground text-base md:text-lg max-w-md">
                Você já praticou os cards deste conteúdo ou eles ainda não foram criados pela inteligência artificial.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-2 justify-center md:justify-start">
                <Button variant="outline" size="lg" className="rounded-2xl h-12 md:h-14 px-8 gap-2 border-accent/20 text-accent w-full sm:w-auto" asChild>
                  <Link href="/">
                    <LayoutDashboard className="w-5 h-5" />
                    Voltar para o Início
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
        
        <div className="hidden lg:flex w-48 h-48 md:w-64 md:h-64 bg-accent/10 rounded-full items-center justify-center relative shadow-[inset_0_0_40px_rgba(var(--accent),0.05)]">
          <div className="absolute inset-0 border-2 border-dashed border-accent/20 rounded-full animate-[spin_30s_linear_infinite]" />
          <BrandLockup variant="mark" className="opacity-40 scale-[3] origin-center" />
        </div>
      </div>
    </div>
  );
}
