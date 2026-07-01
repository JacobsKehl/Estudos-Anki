"use client";

import { useState, useEffect } from "react";
import { 
  ClipboardCheck, 
  ShieldAlert, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Loader2, 
  TrendingUp, 
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function AdminQuestionReviewsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [applied, setApplied] = useState(false);
  const router = useRouter();

  // Verificar se o usuário é administrador ao carregar
  useEffect(() => {
    async function checkAdminStatus() {
      try {
        // Chamamos o endpoint do backfill (modo dry-run) para testar o acesso
        const res = await fetch("/api/question-reviews/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apply: false })
        });
        
        if (res.status === 403) {
          setIsAdmin(false);
        } else if (res.ok) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Erro ao verificar status de admin:", err);
        setIsAdmin(false);
      } finally {
        setLoadingCheck(false);
      }
    }

    checkAdminStatus();
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
    if (confirmText !== "SIM") {
      toast.error("Por favor, digite 'SIM' para confirmar.");
      return;
    }

    setIsConfirmOpen(false);
    setApplyLoading(true);
    try {
      const res = await fetch("/api/question-reviews/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true })
      });

      if (res.ok) {
        toast.success("Carga real aplicada com sucesso!");
        setApplied(true);
        // Atualizar preview com dados reais
        const data = await res.json();
        setPreviewResult(data.result);
      } else {
        const errorData = await res.json();
        toast.error(`Falha na gravação: ${errorData.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      console.error("Erro ao aplicar carga:", err);
      toast.error("Erro de conexão ao aplicar carga.");
    } finally {
      setApplyLoading(false);
      setConfirmText("");
    }
  };

  if (loadingCheck) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Verificando credenciais...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-6 animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8 text-red-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
          <p className="text-sm text-muted-foreground">
            Esta página é destinada exclusivamente para usuários administradores cadastrados na plataforma.
          </p>
        </div>
        <Button onClick={() => router.push("/")} className="rounded-xl font-bold bg-accent">
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-6xl animate-in fade-in duration-500 pb-20">
      <PageHeader 
        icon={ClipboardCheck}
        title="Painel Administrativo — Revisão por Questões"
        description="Visualize e execute a carga inicial (backfill) de revisões por questões para matérias PRIMARY/ACTIVE."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Painel de Controle */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 border border-border/40 rounded-[2rem] bg-card space-y-6 shadow-sm">
            <div className="space-y-2">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" />
                Controles de Carga
              </h3>
              <p className="text-xs text-muted-foreground">
                Siga as etapas abaixo para agendar retroativamente revisões por questões das matérias ativas concluídas.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Etapa 1: Simulação</div>
                <Button 
                  onClick={handlePreview}
                  disabled={previewLoading || applyLoading || applied}
                  className="w-full rounded-xl font-bold h-11 bg-accent border-accent text-accent-foreground flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform active:scale-[0.98]"
                >
                  {previewLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Simulando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Pré-visualizar revisões
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2 pt-2">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Etapa 2: Gravação</div>
                <Button 
                  onClick={() => setIsConfirmOpen(true)}
                  disabled={!previewResult || previewResult.scheduledCount === 0 || applyLoading || applied}
                  className="w-full rounded-xl font-bold h-11 bg-red-600 border-red-600 text-white flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-50 disabled:hover:scale-100 hover:scale-[1.01] transition-all active:scale-[0.98]"
                >
                  {applyLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando no Banco...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Criar revisões
                    </>
                  )}
                </Button>
                {applied && (
                  <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Carga aplicada com sucesso!
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border/40 rounded-[2rem] bg-card space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-accent" />
              Regras do Backfill
            </h4>
            <ul className="text-xs text-muted-foreground/90 space-y-2.5 list-disc pl-4">
              <li>Mapeia apenas blocos com conclusão teórica (`THEORY`) existentes.</li>
              <li>Apenas matérias PRIMARY ou ACTIVE.</li>
              <li>Agenda a revisão para **D+15** da data de estudo original.</li>
              <li>Respeita o limite estrito de **2 revisões por dia**.</li>
              <li>Revisões excedentes são empurradas para dias úteis posteriores automaticamente (overflow).</li>
              <li>Finais de semana são pulados.</li>
            </ul>
          </Card>
        </div>

        {/* Resultados do Preview */}
        <div className="lg:col-span-2">
          {previewResult ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Metadados do Backfill */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border border-border/40 rounded-2xl flex flex-col justify-between h-24">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Elegíveis Totais</span>
                  <span className="text-2xl font-bold text-foreground">{previewResult.totalEligible}</span>
                </Card>
                <Card className="p-4 border border-border/40 rounded-2xl flex flex-col justify-between h-24">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Serão Agendadas</span>
                  <span className="text-2xl font-bold text-accent">{previewResult.scheduledCount}</span>
                </Card>
                <Card className="p-4 border border-border/40 rounded-2xl flex flex-col justify-between h-24">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status Carga</span>
                  <Badge variant={previewResult.dryRun ? "outline" : "default"} className={`w-fit rounded-lg font-bold ${previewResult.dryRun ? "bg-amber-500/10 text-amber-600 border-amber-500/25" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"}`}>
                    {previewResult.dryRun ? "Simulação (Sem Alteração)" : "Gravado no Banco"}
                  </Badge>
                </Card>
              </div>

              {/* Status de escrita */}
              <div className={`p-4 border rounded-2xl flex items-center gap-3 ${previewResult.dryRun ? "bg-amber-500/10 border-amber-500/20 text-amber-700" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"}`}>
                {previewResult.dryRun ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold">
                      Esta é apenas uma simulação (dry-run). Nenhuma escrita foi feita no banco de dados de produção.
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-xs font-semibold">
                      Carga aplicada com sucesso! {previewResult.scheduledCount} tarefas foram criadas e gravadas no banco.
                    </p>
                  </>
                )}
              </div>

              {/* Distribuição das Tarefas */}
              <Card className="border border-border/40 rounded-[2rem] overflow-hidden">
                <div className="p-5 border-b border-border/30 bg-muted/20 flex items-center justify-between">
                  <h3 className="font-bold text-foreground flex items-center gap-2 text-sm uppercase tracking-wider">
                    <Calendar className="w-4 h-4 text-accent" />
                    Cronograma de Revisão Mapeado
                  </h3>
                  <Badge variant="outline" className="rounded-lg font-bold text-[10px] bg-accent/5 border-accent/20 text-accent">
                    Limite: Máx 2/dia útil
                  </Badge>
                </div>

                <div className="divide-y divide-border/30 max-h-[450px] overflow-y-auto">
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
                            <span>Estudado em: {compFormatted}</span>
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
            <div className="border-2 border-dashed border-border/60 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center h-[350px] space-y-4">
              <div className="w-12 h-12 bg-muted border border-border rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">Aguardando Ação</h3>
                <p className="text-xs text-muted-foreground">
                  Clique em &apos;Pré-visualizar revisões&apos; no menu ao lado para listar as pendências teóricas elegíveis e o cronograma simulado.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog de Confirmação Crítica para Carga Real (Etapa 2) */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="rounded-3xl border border-border/40 p-6 max-w-md">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">Confirmar Gravação de Revisões</DialogTitle>
            <p className="text-xs text-muted-foreground/90">
              Você está prestes a gravar **{previewResult?.scheduledCount} revisões por questões** no banco de dados de produção. 
              Isso agendará as tarefas nos respectivos dias de estudo do cronograma.
            </p>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <p className="text-xs font-semibold text-foreground/90">
              Para confirmar, digite exatamente **SIM** no campo abaixo:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite SIM"
              className="rounded-xl border-border/60 focus:ring-red-600/10 focus:border-red-600 h-10 text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsConfirmOpen(false);
                setConfirmText("");
              }}
              className="rounded-xl font-bold border-border/60 h-10 text-xs"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleApply}
              disabled={confirmText !== "SIM" || applyLoading}
              className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white h-10 text-xs active:scale-[0.98] transition-transform"
            >
              Confirmar e Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
