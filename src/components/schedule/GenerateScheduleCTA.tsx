"use client";

import { useState } from "react";
import { Calendar, Plus, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export function GenerateScheduleCTA() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Plano de Estudos Principal",
          dailyMinutes: 60
        }),
      });

      if (!response.ok) throw new Error("Falha ao gerar");

      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar cronograma. Certifique-se de que você tem blocos de estudo criados.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
      <Card className="max-w-md w-full rounded-[2.5rem] border-none bg-sage-light/30 shadow-none text-center p-8">
        <CardHeader className="space-y-4">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto transform -rotate-6 transition-transform hover:rotate-0 duration-500">
            <Calendar className="w-10 h-10 text-accent" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">Seu Cronograma está vazio</CardTitle>
            <CardDescription className="text-base">
              A inteligência do Kehl pode organizar seus blocos de estudo em uma sequência lógica diária.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-4 text-sm text-muted-foreground text-left space-y-3 border border-white/40">
            <div className="flex gap-3">
              <div className="h-5 w-5 bg-accent/20 text-accent rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
              <p>Busca todos os seus <strong>blocos de estudo</strong> não iniciados.</p>
            </div>
            <div className="flex gap-3">
              <div className="h-5 w-5 bg-accent/20 text-accent rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
              <p>Distribui os blocos conforme sua <strong>prioridade de matéria</strong>.</p>
            </div>
            <div className="flex gap-3">
              <div className="h-5 w-5 bg-accent/20 text-accent rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
              <p>Gera um roteiro dia a dia focado na <strong>memorização</strong>.</p>
            </div>
          </div>

          <Button 
            size="lg" 
            className="w-full rounded-2xl h-14 text-lg gap-2 shadow-lg shadow-accent/20"
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Gerar Meu Cronograma
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
