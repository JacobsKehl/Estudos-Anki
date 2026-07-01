"use client";

import { useState } from "react";
import { 
  ClipboardCheck, 
  ExternalLink, 
  CheckCircle2, 
  BookOpen, 
  AlertCircle,
  TrendingUp,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface QuestionReviewCardProps {
  task: any;
  onUpdate?: () => void;
}

export function QuestionReviewCard({ task, onUpdate }: QuestionReviewCardProps) {
  const router = useRouter();
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Modals state
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isCfcOpen, setIsCfcOpen] = useState(false);

  // Form states
  const [questionsAttempted, setQuestionsAttempted] = useState("15");
  const [correctCount, setCorrectCount] = useState("12");
  const [wrongCount, setWrongCount] = useState("3");
  const [notes, setNotes] = useState("");

  const [cfcPdfName, setCfcPdfName] = useState(task.cfcPdfName || "");
  const [cfcStartPage, setCfcStartPage] = useState(task.cfcStartPage?.toString() || "");
  const [cfcEndPage, setCfcEndPage] = useState(task.cfcEndPage?.toString() || "");
  const [cfcTopic, setCfcTopic] = useState(task.cfcTopic || "");
  const [cfcNotes, setCfcNotes] = useState(task.cfcNotes || "");

  // Format date to local Brazil format (DD/MM)
  const formatStudyDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch {
      return "--/--";
    }
  };

  const handleAction = async (actionPath: string, method: string, body: any) => {
    setIsActionLoading(true);
    const toastId = toast.loading("Processando...");
    try {
      const res = await fetch(`/api/question-reviews/${task.id}/${actionPath}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Ocorreu um erro ao realizar a ação.");
      }

      toast.success("Ação concluída com sucesso!", { id: toastId });
      setIsCompleteOpen(false);
      setIsCfcOpen(false);
      if (onUpdate) onUpdate();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Falha na requisição.", { id: toastId });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleComplete = () => {
    const attempted = parseInt(questionsAttempted, 10);
    const correct = parseInt(correctCount, 10);
    const wrong = parseInt(wrongCount, 10);

    if (isNaN(attempted) || attempted < 0) {
      toast.error("Insira um número válido de questões tentadas.");
      return;
    }
    if (!isNaN(correct) && !isNaN(wrong) && correct + wrong !== attempted) {
      toast.warning("A soma de acertos e erros não bate com o total de questões.");
    }

    handleAction("complete", "POST", {
      questionsAttempted: attempted,
      correctCount: isNaN(correct) ? undefined : correct,
      wrongCount: isNaN(wrong) ? undefined : wrong,
      notes
    });
  };

  const handleSkip = () => {
    if (confirm("Tem certeza que deseja pular esta revisão por questões hoje?")) {
      handleAction("skip", "POST", { notes: "Pulado manualmente no dashboard." });
    }
  };

  const handleSaveCfc = () => {
    const start = cfcStartPage ? parseInt(cfcStartPage, 10) : null;
    const end = cfcEndPage ? parseInt(cfcEndPage, 10) : null;

    if (start !== null && isNaN(start)) {
      toast.error("Página inicial do CFC inválida.");
      return;
    }
    if (end !== null && isNaN(end)) {
      toast.error("Página final do CFC inválida.");
      return;
    }

    handleAction("cfc", "PATCH", {
      cfcPdfName,
      cfcStartPage: start,
      cfcEndPage: end,
      cfcTopic,
      cfcNotes
    });
  };

  const handleStartQuestions = () => {
    if (task.questionBankUrl) {
      window.open(task.questionBankUrl, "_blank");
    } else {
      toast.info("Acesse seu banco de questões (QConcursos, TecConcursos, etc.) e faça de 10 a 15 questões deste assunto.", {
        description: "Ao finalizar, clique no botão 'Marcar como revisado' para registrar seu desempenho.",
        duration: 8000
      });
    }
  };

  const isCompleted = task.status === "COMPLETED";
  const isSkipped = task.status === "SKIPPED";

  return (
    <div 
      className={`bg-white dark:bg-card border rounded-[2rem] p-6 shadow-sm transition-all duration-300 ${
        isCompleted 
          ? "border-emerald-500/30 opacity-60 dark:border-emerald-500/10" 
          : isSkipped 
            ? "border-border/30 opacity-50" 
            : "border-sage-light/60 dark:border-accent/15 hover:shadow-md hover:border-sage-light/95 dark:hover:border-accent/25"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        
        {/* Left column: Content details */}
        <div className="space-y-3.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800/30 dark:text-amber-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              {task.sourceSubjectName}
            </Badge>
            {isCompleted && (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/30 dark:text-emerald-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                Revisado
              </Badge>
            )}
            {isSkipped && (
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                Pulado
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-foreground leading-snug">
              {task.sourceBlockTitle}
            </h3>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground/60" />
                Estudado em: <strong className="text-foreground/80">{formatStudyDate(task.sourceStudyDate)}</strong>
              </span>
              {task.sourceMaterialName && (
                <span className="flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-muted-foreground/60" />
                  PDF: <span className="text-foreground/80 truncate max-w-[180px]">{task.sourceMaterialName}</span>
                  {task.sourcePageStart && task.sourcePageEnd && (
                    <span className="text-foreground/60">(p. {task.sourcePageStart}-{task.sourcePageEnd})</span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* CFC Mapping Section */}
          <div className="bg-[#fbf8f3] dark:bg-[#121620] border border-beige/30 dark:border-[#c9ad7f]/10 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#c9ad7f] dark:text-[#d7be94] uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Apoio CFC (Como consultar)
              </span>
              {!isCompleted && !isSkipped && (
                <button 
                  onClick={() => setIsCfcOpen(true)}
                  className="text-[10px] font-bold text-accent hover:underline uppercase tracking-wider bg-transparent border-0 cursor-pointer"
                >
                  {task.cfcPdfName ? "Alterar Mapeamento" : "Mapear CFC"}
                </button>
              )}
            </div>
            
            {task.cfcPdfName ? (
              <div className="space-y-1 text-muted-foreground">
                <p>
                  CFC Material: <strong className="text-foreground/80">{task.cfcPdfName}</strong>
                  {task.cfcStartPage && task.cfcEndPage && (
                    <span className="text-foreground/80 font-semibold"> (p. {task.cfcStartPage}-{task.cfcEndPage})</span>
                  )}
                </p>
                {task.cfcTopic && <p>Tópico: <span className="text-foreground/80">{task.cfcTopic}</span></p>}
                {task.cfcNotes && <p className="italic text-[11px] mt-1 border-t border-beige/20 pt-1">Nota: {task.cfcNotes}</p>}
              </div>
            ) : (
              <p className="text-muted-foreground/60 italic text-[11px]">
                Nenhum mapeamento com material do CFC cadastrado para este assunto.
              </p>
            )}
          </div>

          {!isCompleted && !isSkipped && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/5 dark:bg-amber-500/5 p-2 rounded-xl border border-amber-500/10">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Recomendação: faça de 10 a 15 questões sobre este assunto.</span>
            </div>
          )}

          {isCompleted && (task.questionsAttempted !== null) && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest text-[9px]">Resultado da Revisão</p>
              <p>Questões resolvidas: <strong className="text-foreground/80">{task.questionsAttempted}</strong></p>
              {task.correctCount !== null && task.wrongCount !== null && (
                <p>
                  Acertos: <span className="text-emerald-600 font-bold">{task.correctCount}</span> · Erros: <span className="text-rose-600 font-bold">{task.wrongCount}</span>
                  <span className="font-semibold text-foreground/70 ml-2">({Math.round((task.correctCount / task.questionsAttempted) * 100)}% aproveitamento)</span>
                </p>
              )}
              {task.notes && <p className="italic text-[11px] border-t border-emerald-500/10 pt-1 mt-1">Notas: {task.notes}</p>}
            </div>
          )}
        </div>

        {/* Right column: Action buttons */}
        {!isCompleted && !isSkipped && (
          <div className="flex flex-row md:flex-col items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0">
            <Button
              onClick={handleStartQuestions}
              variant="primary"
              size="sm"
              className="flex-1 md:w-36 h-9 rounded-xl font-bold text-xs uppercase tracking-wider gap-1.5"
            >
              Fazer Questões
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>

            <Button
              onClick={() => setIsCompleteOpen(true)}
              variant="secondary"
              size="sm"
              className="flex-1 md:w-36 h-9 rounded-xl font-bold text-xs uppercase tracking-wider gap-1.5"
            >
              Concluir
              <CheckCircle2 className="w-3.5 h-3.5" />
            </Button>

            <Button
              onClick={handleSkip}
              variant="ghost"
              size="sm"
              className="md:w-36 h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground font-semibold"
            >
              Pular
            </Button>
          </div>
        )}
      </div>

      {/* --- Complete Review Modal --- */}
      <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como Revisado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Registre a quantidade de questões resolvidas e seu desempenho para acompanhar sua precisão no assunto: 
              <strong className="text-foreground/80 block mt-1">{task.sourceBlockTitle}</strong>
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tentativas</label>
                <Input 
                  type="number" 
                  value={questionsAttempted} 
                  onChange={(e) => setQuestionsAttempted(e.target.value)} 
                  className="rounded-xl h-10 text-center font-bold text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Acertos</label>
                <Input 
                  type="number" 
                  value={correctCount} 
                  onChange={(e) => setCorrectCount(e.target.value)} 
                  className="rounded-xl h-10 text-center font-bold text-sm text-emerald-600 border-emerald-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider">Erros</label>
                <Input 
                  type="number" 
                  value={wrongCount} 
                  onChange={(e) => setWrongCount(e.target.value)} 
                  className="rounded-xl h-10 text-center font-bold text-sm text-rose-600 border-rose-500/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Observações/Dúvidas do CFC</label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Ex: Tive dúvida no art. 5º, inciso XI. Consultar CFC p. 14."
                className="rounded-2xl min-h-[80px] text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsCompleteOpen(false)} className="rounded-xl h-10 text-xs font-bold uppercase tracking-wider">
              Cancelar
            </Button>
            <Button 
              onClick={handleComplete} 
              variant="primary" 
              disabled={isActionLoading}
              className="rounded-xl h-10 px-6 text-xs font-bold uppercase tracking-wider gap-1.5"
            >
              {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Registrar Revisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- CFC Mapping Modal --- */}
      <Dialog open={isCfcOpen} onOpenChange={setIsCfcOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Associar com Material CFC</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mapeie as páginas ou capítulos do CFC correspondentes a este assunto de teoria para consultas rápidas em caso de erros:
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nome do PDF do CFC</label>
                <Input 
                  value={cfcPdfName} 
                  onChange={(e) => setCfcPdfName(e.target.value)} 
                  placeholder="Ex: CFC Direito Administrativo.pdf"
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Página Inicial</label>
                  <Input 
                    type="number" 
                    value={cfcStartPage} 
                    onChange={(e) => setCfcStartPage(e.target.value)} 
                    placeholder="Ex: 12"
                    className="rounded-xl h-10 text-xs text-center"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Página Final</label>
                  <Input 
                    type="number" 
                    value={cfcEndPage} 
                    onChange={(e) => setCfcEndPage(e.target.value)} 
                    placeholder="Ex: 22"
                    className="rounded-xl h-10 text-xs text-center"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Título do Tópico no CFC</label>
                <Input 
                  value={cfcTopic} 
                  onChange={(e) => setCfcTopic(e.target.value)} 
                  placeholder="Ex: Atos Administrativos - Espécies"
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Notas de Referência</label>
                <Textarea 
                  value={cfcNotes} 
                  onChange={(e) => setCfcNotes(e.target.value)} 
                  placeholder="Ex: Resumo esquematizado ótimo para revisão cirúrgica."
                  className="rounded-2xl min-h-[60px] text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsCfcOpen(false)} className="rounded-xl h-10 text-xs font-bold uppercase tracking-wider">
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveCfc} 
              variant="primary" 
              disabled={isActionLoading}
              className="rounded-xl h-10 px-6 text-xs font-bold uppercase tracking-wider gap-1.5"
            >
              {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar Mapeamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
