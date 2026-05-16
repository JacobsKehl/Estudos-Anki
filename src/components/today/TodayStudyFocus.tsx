"use client";

import { useState } from "react";
import { 
  CheckCircle2, 
  BrainCircuit, 
  RotateCw, 
  Clock, 
  Layers, 
  ChevronRight,
  BookOpen,
  ArrowRight,
  Loader2,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { GenerateFlashcardsButton } from "@/components/subjects/GenerateFlashcardsButton";

interface TodayStudyFocusProps {
  item: any;
  pendingReviews: number;
}

export function TodayStudyFocus({ item, pendingReviews }: TodayStudyFocusProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const router = useRouter();

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const response = await fetch(`/api/schedule/items/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      if (!response.ok) throw new Error("Falha ao concluir");

      setIsCompleted(true);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Erro ao concluir estudo.");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
      {/* Left Column: Reading Area */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-card border border-border/40 rounded-3xl md:rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col min-h-[400px] md:h-[700px]">
          <div className="p-4 md:p-6 border-b border-border/40 bg-muted/5 flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-accent" />
              </div>
              <div>
                <h2 className="font-bold text-sm md:text-base leading-none">{item.studyBlock.title}</h2>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Páginas {item.studyBlock.pageStart} a {item.studyBlock.pageEnd}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="hidden sm:flex bg-muted text-muted-foreground border-none px-3 py-1">
                {item.extractedText ? Math.max(1, Math.floor(item.extractedText.length / 1500)) : 1} min de leitura
              </Badge>
            </div>
          </div>

          <ScrollArea className="flex-1 p-6 md:p-12">
            <div className="max-w-2xl mx-auto prose prose-sage prose-base md:prose-lg">              {item.extractedText ? (
                <div className="whitespace-pre-wrap leading-relaxed text-foreground/90 font-serif">
                  {item.extractedText}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" />
                  <p className="text-muted-foreground">Carregando conteúdo do bloco...</p>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-6 border-t border-border/40 bg-muted/5 flex items-center justify-center">
            {!isCompleted ? (
              <Button 
                size="lg" 
                className="rounded-2xl h-14 px-12 text-lg gap-2 shadow-lg shadow-accent/20 transition-all hover:scale-[1.02]"
                onClick={handleComplete}
                disabled={isCompleting}
              >
                {isCompleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Marcar como Estudado
              </Button>
            ) : (
              <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 text-green-600 font-bold">
                  <CheckCircle2 className="w-6 h-6" />
                  Estudo concluído!
                </div>
                <div className="flex gap-3">
                  <GenerateFlashcardsButton blockId={item.studyBlockId} />
                  <Button variant="outline" className="rounded-xl" onClick={() => router.push("/schedule")}>
                    Próximo no Cronograma
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Context & Next Steps */}
      <div className="space-y-6">
        {/* Info Card */}
        {item.recommendation && (
          <div className="bg-accent/10 border border-accent/20 rounded-[2rem] p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="w-4 h-4" />
              <h3 className="font-bold text-sm uppercase tracking-wider">Recomendação Inteligente</h3>
            </div>
            <p className="text-xs text-foreground font-medium leading-relaxed italic">
              &quot;{item.recommendation.reason}&quot;
            </p>
          </div>
        )}

        <div className="bg-card border border-border/40 rounded-[2rem] p-6 shadow-sm space-y-6">
          <h3 className="font-bold text-lg">Contexto do Estudo</h3>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Matéria</p>
                <p className="text-sm font-semibold">{item.subject.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tempo Estimado</p>
                <p className="text-sm font-semibold">{item.estimatedMinutes} minutos</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Material de Origem</p>
                <p className="text-sm font-semibold truncate max-w-[150px]">{item.material.fileName}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/40">
             <Button variant="ghost" className="w-full justify-between rounded-xl group px-2">
               <span className="text-sm font-medium">Ver detalhes do bloco</span>
               <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </Button>
          </div>
        </div>

        {/* Review Reminder */}
        {pendingReviews > 0 && (
          <div className="bg-accent/5 border border-accent/10 rounded-[2rem] p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                <RotateCw className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h4 className="font-bold text-accent">Revisões Pendentes</h4>
                <p className="text-xs text-muted-foreground">Você tem {pendingReviews} cards hoje.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Consolide o que você estudou em dias anteriores antes de avançar demais.
            </p>
            <Button className="w-full rounded-xl bg-accent hover:bg-accent/90" onClick={() => router.push("/reviews")}>
              Revisar Agora
            </Button>
          </div>
        )}

        {/* Motivation Card */}
        <div className="bg-gradient-to-br from-sage-light/30 to-white border border-sage-light/40 rounded-[2rem] p-6 text-center space-y-3">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Logo size={24} className="opacity-60" />
          </div>
          <h4 className="font-bold">Foco no Processo</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            &quot;O segredo do sucesso é a constância do propósito.&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
