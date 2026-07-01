"use client";

import { useState, useEffect } from "react";
import { 
  ClipboardCheck, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Loader2, 
  TrendingUp, 
  ArrowLeft,
  BookOpen,
  Sparkles,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function QuestionReviewsHubPage() {
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [hasExistingReviews, setHasExistingReviews] = useState(false);
  
  const router = useRouter();

  // Verificar se o usuário já possui revisões por questões cadastradas no banco
  useEffect(() => {
    async function checkExistingReviews() {
      try {
        const res = await fetch("/api/question-reviews");
        if (res.ok) {
          const data = await res.json();
          // Se tiver stats.completedCount > 0 ou stats.pendingCount > 0, consideramos que já tem tarefas
          const stats = data.stats;
          if (stats && (stats.completedCount > 0 || stats.pendingCount > 0)) {
            setHasExistingReviews(true);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados de revisão:", err);
      } finally {
        setLoading(false);
      }
    }

    checkExistingReviews();
  }, []);

  // Executar simulação (Dry-Run)
  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const res = await fetch("/api/question-reviews/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: false })
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewResult(data.result);
        toast.success("Preview gerado com sucesso!");
      } else {
        const errorData = await res.json();
        toast.error(`Falha no preview: ${errorData.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      console.error("Erro ao gerar preview:", err);
      toast.error("Erro de conexão ao gerar preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Executar gravação real (Apply)
  const handleApply = async () => {
    setIsConfirmOpen(false);
    setApplyLoading(true);
    try {
      const res = await fetch("/api/question-reviews/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true })
      });

      if (res.ok) {
        toast.success("Revisões iniciais criadas com sucesso!");
        setApplied(true);
        setHasExistingReviews(true);
        const data = await res.json();
        setPreviewResult(data.result);
      } else {
        const errorData = await res.json();
        toast.error(`Falha ao criar revisões: ${errorData.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      console.error("Erro ao aplicar carga:", err);
      toast.error("Erro de conexão ao aplicar.");
    } finally {
      setApplyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-accent transition-colors cursor-pointer" onClick={() => router.push("/")}>
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar ao Hoje</span>
      </div>

      <PageHeader 
        icon={ClipboardCheck}
        title="Revisão por Questões"
        description="Assuntos estudados anteriormente agendados para revisão ativa por meio de resolução de questões."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Painel de Controle */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 border border-border/40 rounded-[2rem] bg-card space-y-6 shadow-sm">
            <div className="space-y-2">
              <h3 className="font-bold text-foreground flex items-center gap-2 text-sm uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-accent" />
                Carga Inicial
              </h3>
              <p className="text-xs text-muted-foreground">
                Se você possui blocos de teoria já concluídos antes da ativação da funcionalidade, pode gerar as revisões correspondentes retroativamente.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Passo 1: Visualizar</div>
                <Button 
                  onClick={handlePreview}
                  disabled={previewLoading || applyLoading || applied}
                  className="w-full rounded-xl font-bold h-11 bg-accent border-accent text-accent-foreground flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform active:scale-[0.98]"
                >
                  {previewLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mapeando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Pré-visualizar revisões iniciais
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2 pt-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Passo 2: Confirmar</div>
                <Button 
                  onClick={() => setIsConfirmOpen(true)}
                  disabled={!previewResult || previewResult.scheduledCount === 0 || applyLoading || applied}
                  className="w-full rounded-xl font-bold h-11 bg-emerald-600 border-emerald-600 text-white flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:scale-100 hover:scale-[1.01] transition-all active:scale-[0.98]"
                >
                  {applyLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Preparar revisões iniciais
                    </>
                  )}
                </Button>
                {applied && (
                  <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Carga de revisões agendada com sucesso!
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border/40 rounded-[2rem] bg-card space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-accent" />
              Regras Importantes
            </h4>
            <ul className="text-xs text-muted-foreground/90 space-y-2.5 list-disc pl-4">
              <li>Mapeia apenas blocos com conclusão teórica (`THEORY`) existentes.</li>
              <li>Apenas matérias `PRIMARY` ou `ACTIVE`.</li>
              <li>Agenda a revisão para **D+15** da data de estudo original.</li>
              <li>Respeita o limite de **2 revisões por dia**.</li>
              <li>Revisões excedentes são empurradas para dias úteis posteriores automaticamente (overflow).</li>
              <li>Finais de semana são pulados.</li>
              <li>**Não duplica** revisões para o mesmo bloco teórico.</li>
            </ul>
          </Card>
        </div>

        {/* Resultados do Preview / Calendário */}
        <div className="lg:col-span-2">
          {previewResult ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Metadados do Backfill */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border border-border/40 rounded-2xl flex flex-col justify-between h-24">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Blocos Elegíveis</span>
                  <span className="text-2xl font-bold text-foreground">{previewResult.totalEligible}</span>
                </Card>
                <Card className="p-4 border border-border/40 rounded-2xl flex flex-col justify-between h-24">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Agendados (Carga Máx 30)</span>
                  <span className="text-2xl font-bold text-accent">{previewResult.scheduledCount}</span>
                </Card>
                <Card className="p-4 border border-border/40 rounded-2xl flex flex-col justify-between h-24">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status das Alterações</span>
                  <Badge variant={previewResult.dryRun ? "outline" : "default"} className={`w-fit rounded-lg font-bold ${previewResult.dryRun ? "bg-amber-500/10 text-amber-600 border-amber-500/25" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"}`}>
                    {previewResult.dryRun ? "Simulação (Dry-Run)" : "Confirmado & Criado"}
                  </Badge>
                </Card>
              </div>

              {/* Status de escrita */}
              <div className={`p-4 border rounded-2xl flex items-center gap-3 ${previewResult.dryRun ? "bg-amber-500/10 border-amber-500/20 text-amber-700" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"}`}>
                {previewResult.dryRun ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold">
                      Esta é apenas uma simulação. Nenhuma alteração foi efetuada em seu cronograma ou banco de dados.
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-xs font-semibold">
                      Revisões criadas com sucesso! {previewResult.scheduledCount} tarefas foram integradas ao seu fluxo de estudos diários.
                    </p>
                  </>
                )}
              </div>

              {/* Distribuição das Tarefas */}
              <Card className="border border-border/40 rounded-[2rem] overflow-hidden">
                <div className="p-5 border-b border-border/30 bg-muted/20 flex items-center justify-between">
                  <h3 className="font-bold text-foreground flex items-center gap-2 text-sm uppercase tracking-wider">
                    <Calendar className="w-4 h-4 text-accent" />
                    Distribuição das Revisões Agendadas
                  </h3>
                  <Badge variant="outline" className="rounded-lg font-bold text-[10px] bg-accent/5 border-accent/20 text-accent">
                    Máx 2/dia
                  </Badge>
                </div>

                <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
                  {previewResult.preview.map((item: any, idx: number) => {
                    const dateStr = item.scheduledDate.split("T")[0];
                    const [year, month, day] = dateStr.split("-");
                    const formattedDate = `${day}/${month}/${year}`;

                    const compDateStr = item.completedAt ? item.completedAt.split("T")[0] : null;
                    const compFormatted = compDateStr ? `${compDateStr.split("-")[2]}/${compDateStr.split("-")[1]}/${compDateStr.split("-")[0]}` : "N/A";

                    return (
                      <div key={idx} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-foreground">{item.blockTitle}</div>
                          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                            <span>{item.subjectName}</span>
                            <span className="text-muted-foreground/30">•</span>
                            <span>Concluído em: {compFormatted}</span>
                          </div>
                        </div>
                        <Badge className="bg-sage-light text-accent rounded-lg font-bold shrink-0">
                          {formattedDate}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border/60 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center h-[350px] space-y-4 bg-muted/5">
              <div className="w-12 h-12 bg-muted border border-border rounded-2xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">Cronograma Inicial</h3>
                <p className="text-xs text-[#8c9a86] font-medium leading-relaxed">
                  {hasExistingReviews 
                    ? "Você já possui revisões por questões criadas em seu cronograma. Se desejar rodar novamente o backfill para agendar blocos recém-concluídos, clique no botão ao lado."
                    : "Você ainda não configurou revisões por questões para o seu histórico. Clique em 'Pré-visualizar revisões iniciais' para simular o agendamento."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog de Confirmação Clara (Etapa 2) */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="rounded-3xl border border-border/40 p-6 max-w-md">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">Confirmar Criação das Revisões</DialogTitle>
            <p className="text-xs text-muted-foreground/90 leading-relaxed">
              Serão criadas até 30 revisões por questões com base nos blocos de teoria já concluídos. Isso não altera seu cronograma principal, flashcards, SRS ou e-mail diário.
            </p>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setIsConfirmOpen(false)}
              className="rounded-xl font-bold border-border/60 h-10 text-xs"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleApply}
              className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-10 text-xs active:scale-[0.98] transition-transform"
            >
              Confirmar criação das revisões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
