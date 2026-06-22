"use client";

import * as React from "react";
import { 
  ArrowLeft, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ExternalLink,
  ChevronRight,
  BrainCircuit,
  Loader2,
  Play,
  Pause,
  Layers,
  RotateCcw,
  Sparkles,
  Trophy,
  Calendar,
  Info,
  Zap,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PdfBlockViewer } from "./PdfBlockViewer";
import { CardCurator } from "@/components/flashcards/CardCurator";

const SUPPORT_TYPE_LABELS: Record<string, string> = {
  SUMMARY: "Resumo Teórico",
  BIZU: "Bizu / Dica Rápida",
  MIND_MAP: "Mapa Mental",
  CHECKLIST: "Checklist",
  REVIEW: "Revisão Rápida",
  QUESTIONS: "Questões Práticas",
  COMMENTED_QUESTIONS: "Questões Comentadas",
  SIMULATED_EXAM: "Simulado de Prova",
  ANSWER_KEY: "Gabarito de Conferência",
  OTHER: "Material de Apoio",
};

const getSchemaSupportDescription = (supportType: string) => {
  switch (supportType) {
    case "SUMMARY":
    case "BIZU":
    case "REVIEW":
      return "Resumo teórico sintetizado e bizus do conteúdo para revisão rápida dos pontos-chave antes das provas.";
    case "MIND_MAP":
      return "Mapa mental visual estruturado para facilitar a memorização rápida e associação de conceitos.";
    case "CHECKLIST":
      return "Checklist de controle de tópicos para garantir que nenhum assunto importante seja esquecido.";
    case "QUESTIONS":
      return "Caderno de exercícios práticos com questões selecionadas do material para fixação e teste de conhecimento.";
    case "COMMENTED_QUESTIONS":
      return "Questões comentadas passo a passo, auxiliando na compreensão detalhada de cada alternativa e gabarito.";
    case "SIMULATED_EXAM":
      return "Simulado de prova completo para testar seu desempenho sob condições reais de exame.";
    case "ANSWER_KEY":
      return "Gabarito de conferência oficial para rápida verificação e validação das respostas.";
    default:
      return "Material complementar de apoio pedagógico focado em potencializar seu aprendizado e fixação.";
  }
};

interface ContinueSuggestion {
  type: "OVERDUE" | "SAME_SUBJECT" | "TODAY_CYCLE" | "NEXT_ELIGIBLE" | "SECOND_PASS";
  scheduleItemId?: string;
  studyBlockId?: string;
  subjectName: string;
  blockTitle: string;
  estimatedMinutes?: number;
  reason: string;
  scheduledDate?: string;
}

interface BlockStudyViewProps {
  block: any;
  content: any[];
  stats: {
    total: number;
    pending: number;
    approved: number;
  };
  returnTo: string | null;
  from: string | null;
  scheduleItemId?: string | null;
  secondPass?: boolean;
}

// Helper functions moved outside of render to prevent ESLint static-components warnings and fix missing dependency warnings
const getCleanPath = (path: string) => path.split("?")[0];

const getReturnLabel = (path: string): string => {
  const cleanPath = getCleanPath(path);
  if (cleanPath === "/") return "Voltar para Hoje";
  if (cleanPath === "/schedule") return "Voltar para Cronograma";
  if (cleanPath.startsWith("/materials")) return "Voltar para Material";
  if (cleanPath.startsWith("/subjects")) return "Voltar para Matéria";
  if (cleanPath.startsWith("/flashcards")) return "Voltar para Flashcards";
  return "Voltar";
};

const getReturnIcon = (path: string) => {
  const cleanPath = getCleanPath(path);
  if (cleanPath === "/") return Calendar;
  if (cleanPath === "/schedule") return Clock;
  if (cleanPath.startsWith("/materials")) return FileText;
  if (cleanPath.startsWith("/subjects")) return BookOpen;
  if (cleanPath.startsWith("/flashcards")) return BrainCircuit;
  return ArrowLeft;
};

export function BlockStudyView({ block, content, stats, returnTo, from, scheduleItemId, secondPass = false }: BlockStudyViewProps) {
  const router = useRouter();

  // Get return target with validation (no external URL allowed to avoid open redirect)
  const returnTarget = React.useMemo(() => {
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      return {
        href: returnTo,
        label: getReturnLabel(returnTo),
      };
    }
    // Backward compatibility for the `from` query param
    if (from === "today") return { href: "/", label: "Voltar para Hoje" };
    if (from === "schedule") return { href: "/schedule", label: "Voltar para Cronograma" };
    if (from === "materials") return { href: "/materials", label: "Voltar para Material" };
    if (from && from.startsWith("material-")) {
      const materialId = from.replace("material-", "");
      return { href: `/materials/${materialId}`, label: "Voltar para Material" };
    }
    if (from && from.startsWith("subject-")) {
      const subjectId = from.replace("subject-", "");
      return { href: `/subjects/${subjectId}`, label: "Voltar para Matéria" };
    }
    // Safe default fallback
    return {
      href: `/subjects/${block.subjectId}`,
      label: "Voltar para Matéria",
    };
  }, [returnTo, from, block.subjectId]);
  
  // Step State Flow: "reading" -> "curating" -> "summary"
  const [step, setStep] = React.useState<"reading" | "curating" | "summary">(() => {
    if (secondPass) return "reading"; // Second pass always starts in reading mode
    if (block.status === "COMPLETED") {
      return "summary";
    }
    const pendingCards = (block.flashcards || []).filter((f: any) => f.status === "PENDING_APPROVAL");
    if (pendingCards.length > 0) {
      return "curating";
    }
    return "reading";
  });
  const [isSecondPass] = React.useState(secondPass);

  const [curatorCards, setCuratorCards] = React.useState<any[]>(block.flashcards || []);
  const [timeSpent, setTimeSpent] = React.useState(0);
  const [isTimerRunning, setIsTimerRunning] = React.useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = React.useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [startedAt, setStartedAt] = React.useState<Date | null>(null);
  const [isIdleAlertOpen, setIsIdleAlertOpen] = React.useState(false);
  const lastActivityRef = React.useRef(0);
  const [suggestions, setSuggestions] = React.useState<ContinueSuggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = React.useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = React.useState(false);

  // Initialize lastActivityRef on mount (avoids impure Date.now() call during render)
  React.useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Capture startedAt when timer starts
  React.useEffect(() => {
    if (isTimerRunning && !startedAt && step === "reading") {
      setStartedAt(new Date());
    }
  }, [isTimerRunning, startedAt, step]);

  // Idle Detection effect
  React.useEffect(() => {
    if (!isTimerRunning || step !== "reading") return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    const checkIdleInterval = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime > 15 * 60 * 1000) { // 15 minutos
        setIsTimerRunning(false);
        setIsIdleAlertOpen(true);
      }
    }, 1000);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      clearInterval(checkIdleInterval);
    };
  }, [isTimerRunning, step]);

  const handleResumeFromIdle = () => {
    lastActivityRef.current = Date.now();
    setIsIdleAlertOpen(false);
    setIsTimerRunning(true);
  };

  const [activeTab, setActiveTab] = React.useState<"pdf" | "text" | "apoios">("pdf");
  const hasApoios = block.supportMaterials && block.supportMaterials.length > 0;

  const [pdfViewerProps, setPdfViewerProps] = React.useState({
    materialId: block.materialId,
    pageStart: block.pageStart,
    pageEnd: block.pageEnd,
    title: block.title,
    isSupport: false,
    description: "",
    supportType: "",
  });

  React.useEffect(() => {
    setPdfViewerProps({
      materialId: block.materialId,
      pageStart: block.pageStart,
      pageEnd: block.pageEnd,
      title: block.title,
      isSupport: false,
      description: "",
      supportType: "",
    });
  }, [block.id, block.materialId, block.pageStart, block.pageEnd, block.title]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "apoios") {
        setActiveTab("apoios");
      }
    }
  }, []);

  // Timer Tick Hook
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && step === "reading") {
      interval = setInterval(() => {
        setTimeSpent((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, step]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Fetch continuation suggestions when entering summary step
  React.useEffect(() => {
    if (step !== "summary" || isSecondPass) return;
    
    const fetchSuggestions = async () => {
      setIsFetchingSuggestions(true);
      try {
        const res = await fetch(`/api/schedule/continue-suggestions?completedBlockId=${block.id}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (e) {
        console.error("Erro ao buscar sugestões de continuação:", e);
      } finally {
        setIsFetchingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [step, block.id, isSecondPass]);

  // Second pass completion handler
  const handleCompleteSecondPass = async () => {
    if (startedAt === null) {
      const proceed = window.confirm("Você quer concluir sem registrar tempo real de estudo?");
      if (!proceed) return;
    }
    setIsUpdatingStatus(true);
    setIsTimerRunning(false);
    const toastId = toast.loading("Registrando segunda leitura...");
    
    try {
      const res = await fetch("/api/study-session-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyBlockId: block.id,
          actionType: "SECOND_PASS",
          startedAt: startedAt ? startedAt.toISOString() : null,
          completedAt: startedAt ? new Date().toISOString() : null,
          actualDurationMinutes: startedAt ? Math.max(1, Math.round(timeSpent / 60)) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao registrar segunda leitura");
      }

      toast.success("Segunda leitura registrada com sucesso!", { id: toastId });
      router.push("/");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao registrar segunda leitura.", { id: toastId });
      if (startedAt !== null) {
        setIsTimerRunning(true);
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Helper to get suggestion icon and style
  const getSuggestionDisplay = (type: string) => {
    switch (type) {
      case "OVERDUE": return { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50 border-red-100 hover:border-red-200", label: "Atrasada" };
      case "SAME_SUBJECT": return { icon: BookOpen, color: "text-blue-500", bg: "bg-blue-50 border-blue-100 hover:border-blue-200", label: "Mesma matéria" };
      case "TODAY_CYCLE": return { icon: Calendar, color: "text-amber-500", bg: "bg-amber-50 border-amber-100 hover:border-amber-200", label: "Tarefa do dia" };
      case "NEXT_ELIGIBLE": return { icon: Layers, color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-100 hover:border-emerald-200", label: "Ciclo principal" };
      case "SECOND_PASS": return { icon: RefreshCw, color: "text-violet-500", bg: "bg-violet-50 border-violet-100 hover:border-violet-200", label: "Releitura" };
      default: return { icon: Play, color: "text-muted-foreground", bg: "bg-muted/30 border-border/20", label: "" };
    }
  };

  // State 1: Action - complete reading, trigger flashcard generation, and auto-approve / complete block
  const handleCompleteReading = async () => {
    if (startedAt === null) {
      const proceed = window.confirm("Você quer concluir sem registrar tempo real de estudo?");
      if (!proceed) return;
    }
    setIsGeneratingCards(true);
    setIsTimerRunning(false);
    const toastId = toast.loading("Gerando flashcards com IA baseados na leitura...");
    
    try {
      const response = await fetch(`/api/blocks/${block.id}/flashcards/generate`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        // If cards were already generated, we just proceed to mark the block as completed if not already done
        if (response.status === 400 && data.error?.includes("já gerou")) {
          toast.loading("Flashcards já gerados. Registrando conclusão do bloco...", { id: toastId });
          
          const completeRes = await fetch(`/api/study-blocks/${block.id}/complete-step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              step: "THEORY",
              scheduleItemId,
              startedAt: startedAt ? startedAt.toISOString() : null,
              completedAt: startedAt ? new Date().toISOString() : null,
              actualDurationMinutes: startedAt ? Math.max(1, Math.round(timeSpent / 60)) : null
            }),
          });

          if (completeRes.ok) {
            toast.success("Estudo concluído! Bons estudos.", { id: toastId });
            setStep("summary");
          } else {
            const completeData = await completeRes.json();
            throw new Error(completeData.error || "Falha ao registrar conclusão do bloco");
          }
          router.refresh();
          return;
        }
        throw new Error(data.error || "Falha ao gerar flashcards");
      }

      // Now complete the block study step automatically since curation is bypassed
      toast.loading("Flashcards criados! Registrando conclusão do bloco...", { id: toastId });
      
      const completeRes = await fetch(`/api/study-blocks/${block.id}/complete-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          step: "THEORY",
          scheduleItemId,
          startedAt: startedAt ? startedAt.toISOString() : null,
          completedAt: startedAt ? new Date().toISOString() : null,
          actualDurationMinutes: startedAt ? Math.max(1, Math.round(timeSpent / 60)) : null
        }),
      });

      if (!completeRes.ok) {
        const completeData = await completeRes.json();
        throw new Error(completeData.error || "Flashcards gerados, mas falha ao concluir o bloco");
      }

      toast.success("Flashcards prontos e bloco concluído!", { id: toastId });
      
      if (data.flashcards && data.flashcards.length > 0) {
        setCuratorCards(data.flashcards);
      }
      setStep("summary");
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao processar conclusão. Tente novamente.", { id: toastId });
      if (startedAt !== null) {
        setIsTimerRunning(true); // Resume timer on failure
      }
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const handleGenerateMoreCards = async () => {
    setIsGeneratingMore(true);
    const toastId = toast.loading("Analisando conteúdo e gerando mais flashcards adicionais...");
    try {
      const res = await fetch(`/api/blocks/${block.id}/flashcards/generate-more`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar flashcards adicionais");
      }
      toast.success(data.message || `${data.count} novos flashcards gerados!`, { id: toastId });
      router.refresh();
      if (data.flashcards && data.flashcards.length > 0) {
        setCuratorCards((prev) => [...prev, ...data.flashcards]);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar mais flashcards com IA.", { id: toastId });
    } finally {
      setIsGeneratingMore(false);
    }
  };

  // State 2: Action - Curation complete, lock block as COMPLETED
  const handleCurationComplete = async () => {
    if (startedAt === null) {
      const proceed = window.confirm("Você quer concluir sem registrar tempo real de estudo?");
      if (!proceed) return;
    }
    setIsUpdatingStatus(true);
    const toastId = toast.loading("Registrando conclusão do bloco de estudo...");
    
    try {
      const res = await fetch(`/api/study-blocks/${block.id}/complete-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          step: "THEORY",
          scheduleItemId,
          startedAt: startedAt ? startedAt.toISOString() : null,
          completedAt: startedAt ? new Date().toISOString() : null,
          actualDurationMinutes: startedAt ? Math.max(1, Math.round(timeSpent / 60)) : null
        }),
      });
      
      if (!res.ok) throw new Error("Erro ao concluir bloco");
      const data = await res.json();
      
      toast.success(data.message || "Bloco concluído! Parabéns pelos estudos.", { id: toastId });
      setStep("summary");
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao concluir o bloco de estudo.", { id: toastId });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // State 3: Action - Reopen block
  const handleReopen = async () => {
    setIsUpdatingStatus(true);
    const toastId = toast.loading("Reabrindo bloco de estudo...");
    
    try {
      const res = await fetch(`/api/blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      
      if (!res.ok) throw new Error("Erro ao reabrir bloco");
      
      toast.success("Estudo teórico reaberto! O cronograma foi atualizado.", { id: toastId });
      
      // Reset local flow states
      setStep("reading");
      setTimeSpent(0);
      setIsTimerRunning(false);
      setStartedAt(null);
      
      // Update local flashcards state with latest fetched state
      const updatedBlock = await res.json();
      if (updatedBlock.flashcards) {
        setCuratorCards(updatedBlock.flashcards);
      }
      
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao reabrir o bloco de estudo.", { id: toastId });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "NOT_STARTED": return { label: "Não Iniciado", color: "bg-muted text-muted-foreground" };
      case "IN_PROGRESS": return { label: "Estudando", color: "bg-amber-50 text-amber-600 border-amber-100" };
      case "COMPLETED": return { label: "Concluído", color: "bg-accent/10 text-accent border-accent/20" };
      case "SKIPPED": return { label: "Pulado", color: "bg-red-50 text-red-600 border-red-100" };
      default: return { label: status, color: "bg-muted text-muted-foreground" };
    }
  };

  const statusInfo = getStatusDisplay(block.status);

  // ==========================================
  // RENDER STEP 2: CURATING (Full Width Curator)
  // ==========================================
  if (step === "curating") {
    return (
      <div className="max-w-5xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
        {/* Back navigation header to reading view */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-xl hover:bg-accent/5 gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            onClick={() => setStep("reading")}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Leitura
          </Button>
        </div>

        <CardCurator 
          blockId={block.id} 
          initialCards={curatorCards} 
          onCurationComplete={handleCurationComplete} 
        />
      </div>
    );
  }

  // ==========================================
  // RENDER STEP 3: SUMMARY
  // ==========================================
  if (step === "summary") {
    const approvedCount = curatorCards.filter((c) => c.status === "APPROVED").length;
    const isSubjectExcluded = block.subject?.studyPriority === "EXCLUDED";
    const isSupportMaterial = block.material?.materialRole === "SUPPORT_MATERIAL";
    const showGenerateMoreSummary = !isSubjectExcluded && !isSupportMaterial && approvedCount > 0 && approvedCount < 18;

    return (
      <div className="max-w-3xl mx-auto py-12 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-card rounded-[2.5rem] border border-border/40 p-10 shadow-sm text-center space-y-8">
          {/* Celebratory Badge & Icon */}
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 rounded-[2rem] bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Trophy className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="bg-accent/10 text-accent border-none font-bold text-xs uppercase tracking-wider px-4 py-1 rounded-full">
                Sessão Concluída!
              </Badge>
              <h2 className="text-3xl font-black text-foreground tracking-tight">{block.title}</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Seu estudo teórico foi registrado e os flashcards curados foram integrados ao seu cronograma de revisões ativas.
              </p>
            </div>
          </div>

          {/* Session Statistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-muted/30 border border-border/20 rounded-2xl p-5 flex flex-col items-center justify-center space-y-2">
              <div className="p-2 rounded-xl bg-accent/5 text-accent">
                <Clock className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className="block text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Tempo de Leitura</span>
                <span className="text-lg font-black text-foreground tabular-nums">{formatTimer(timeSpent || (block.estimatedStudyMinutes * 60))}</span>
              </div>
            </div>

            <div className="bg-muted/30 border border-border/20 rounded-2xl p-5 flex flex-col items-center justify-center space-y-2">
              <div className="p-2 rounded-xl bg-accent/5 text-accent">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className="block text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Cards Adicionados</span>
                <span className="text-lg font-black text-foreground">{approvedCount} cards</span>
              </div>
            </div>

            <div className="bg-muted/30 border border-border/20 rounded-2xl p-5 flex flex-col items-center justify-center space-y-2">
              <div className="p-2 rounded-xl bg-accent/5 text-accent">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className="block text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Próxima Revisão</span>
                <span className="text-lg font-black text-foreground">Amanhã (D+1)</span>
              </div>
            </div>
          </div>

          {/* Continue Studying Suggestions */}
          {!isSecondPass && (isFetchingSuggestions || suggestions.length > 0) && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-foreground">
                  {timeSpent > 0 && block.estimatedStudyMinutes && Math.round(timeSpent / 60) < block.estimatedStudyMinutes
                    ? "Você terminou mais rápido! Quer aproveitar o saldo de tempo?"
                    : "Deseja continuar estudando?"}
                </h3>
              </div>

              {isFetchingSuggestions ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestions.filter(s => s.type !== "SECOND_PASS").map((suggestion, idx) => {
                    const display = getSuggestionDisplay(suggestion.type);
                    const SuggestionIcon = display.icon;

                    // Build navigation URL
                    const href = suggestion.type === "OVERDUE" || suggestion.type === "TODAY_CYCLE"
                      ? `/blocks/${suggestion.studyBlockId}?scheduleItemId=${suggestion.scheduleItemId}&returnTo=/`
                      : `/blocks/${suggestion.studyBlockId}?returnTo=/`;

                    return (
                      <Link
                        key={`suggestion-${idx}`}
                        href={href}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${display.bg}`}
                      >
                        <div className={`p-2 rounded-xl ${display.color}`}>
                          <SuggestionIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{suggestion.subjectName}</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">{display.label}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{suggestion.blockTitle} · {suggestion.reason}</span>
                        </div>
                        {suggestion.estimatedMinutes && (
                          <span className="text-xs font-semibold text-muted-foreground tabular-nums">{suggestion.estimatedMinutes} min</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                      </Link>
                    );
                  })}

                  {/* Second Pass option */}
                  {suggestions.some(s => s.type === "SECOND_PASS") && (
                    <Link
                      href={`/blocks/${block.id}?secondPass=true&returnTo=/`}
                      className="flex items-center gap-4 p-4 rounded-2xl border transition-all bg-violet-50 border-violet-100 hover:border-violet-200"
                    >
                      <div className="p-2 rounded-xl text-violet-500">
                        <RefreshCw className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">Reler este bloco</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">Releitura</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Segunda leitura (não altera cronograma)</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-4 border-t border-border/30 flex flex-col sm:flex-row items-center justify-center gap-4">
            {approvedCount > 0 ? (
              <Button 
                variant="primary" 
                size="lg" 
                className="rounded-2xl font-bold w-full sm:w-auto shadow-md shadow-accent/15 transition-all hover:scale-[1.02]" 
                asChild
              >
                <Link href={`/practice?blockId=${block.id}`}>
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Praticar Cards Agora
                </Link>
              </Button>
            ) : (
              <Button 
                variant="primary" 
                size="lg" 
                className="rounded-2xl font-bold w-full sm:w-auto opacity-50 cursor-not-allowed" 
                disabled
              >
                Nenhum card para praticar
              </Button>
            )}

            {showGenerateMoreSummary && (
              <Button
                variant="outline"
                size="lg"
                className="rounded-2xl font-bold w-full sm:w-auto border-dashed border-accent/60 text-accent hover:bg-accent/5 transition-all"
                onClick={handleGenerateMoreCards}
                disabled={isGeneratingMore}
              >
                {isGeneratingMore ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2 text-accent" />
                )}
                {isGeneratingMore ? "Gerando mais..." : "Gerar mais cards"}
              </Button>
            )}

            <Button 
              variant="soft" 
              size="lg" 
              className="rounded-2xl font-bold w-full sm:w-auto text-muted-foreground hover:text-foreground" 
              asChild
            >
              <Link href={returnTarget.href}>
                {returnTarget.label}
              </Link>
            </Button>
          </div>

          {/* Subtitle Links */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2 text-xs font-semibold text-muted-foreground">
            <Link href={`/flashcards?blockId=${block.id}`} className="hover:text-accent flex items-center gap-1.5 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              Ver repositório de cards
            </Link>
            <button 
              onClick={handleReopen} 
              disabled={isUpdatingStatus}
              className="hover:text-accent flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0 font-semibold transition-colors"
            >
              {isUpdatingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Reabrir bloco e reestudar teoria
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER STEP 1: READING (Original Flow View)
  // ==========================================
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32 animate-in fade-in duration-700">
      {/* Header Focado */}
      <header className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="iconOnly" className="rounded-full hover:bg-accent/5" aria-label={returnTarget.label} asChild>
            <Link href={returnTarget.href}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <Link href={`/subjects/${block.subjectId}`} className="hover:text-accent transition-colors">
              {block.subject.name}
            </Link>
            <ChevronRight className="w-4 h-4 opacity-30" />
            <span className="text-foreground/60">{isSecondPass ? "Segunda Leitura" : "Bloco de Estudo"}</span>
          </div>
        </div>

        {/* Second Pass Banner */}
        {isSecondPass && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-violet-50 border border-violet-100 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw className="w-5 h-5 text-violet-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-violet-800">Modo de segunda leitura</p>
              <p className="text-xs text-violet-600">O cronograma e os flashcards não serão alterados. Apenas o tempo será registrado.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-card p-8 rounded-[2.5rem] border border-border/40 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{block.title}</h1>
                <Badge variant="outline" className={`rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusInfo.color}`}>
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-center gap-2 font-medium">
                <FileText className="w-4 h-4" />
                {block.material.fileName} • Páginas {block.pageStart} a {block.pageEnd}
              </p>
            </div>
            
            {block.description && (
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed italic border-l-2 border-accent/20 pl-4 py-1">
                {block.description}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-8 items-start">
        {/* Área de Leitura */}
        <main className="space-y-6">
          <div className="flex items-center gap-2 mb-4 p-1 bg-muted/30 rounded-2xl w-fit">
            <Button 
              variant={activeTab === "pdf" && !pdfViewerProps.isSupport ? "secondary" : "ghost"} 
              size="sm" 
              className={`rounded-xl h-9 px-6 text-xs font-bold uppercase tracking-wider ${activeTab === "pdf" && !pdfViewerProps.isSupport ? "bg-white shadow-sm" : ""}`}
              onClick={() => {
                setPdfViewerProps({
                  materialId: block.materialId,
                  pageStart: block.pageStart,
                  pageEnd: block.pageEnd,
                  title: block.title,
                  isSupport: false,
                  description: "",
                  supportType: "",
                });
                setActiveTab("pdf");
              }}
            >
              <FileText className="w-3.5 h-3.5 mr-2" />
              PDF Original
            </Button>
            <Button 
              variant={activeTab === "text" ? "secondary" : "ghost"} 
              size="sm" 
              className={`rounded-xl h-9 px-6 text-xs font-bold uppercase tracking-wider ${activeTab === "text" ? "bg-white shadow-sm" : ""}`}
              onClick={() => setActiveTab("text")}
            >
              <FileText className="w-3.5 h-3.5 mr-2" />
              Texto Extraído
            </Button>
            {hasApoios && (
              <Button 
                variant={activeTab === "apoios" ? "secondary" : "ghost"} 
                size="sm" 
                className={`rounded-xl h-9 px-6 text-xs font-bold uppercase tracking-wider ${activeTab === "apoios" ? "bg-white shadow-sm" : ""}`}
                onClick={() => setActiveTab("apoios")}
              >
                <Layers className="w-3.5 h-3.5 mr-2" />
                Apoios ({block.supportMaterials.length})
              </Button>
            )}
          </div>

          {activeTab === "apoios" ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {(() => {
                const supports = block.supportMaterials || [];
                
                const summaries = supports.filter((s: any) => 
                  ["SUMMARY", "BIZU", "MIND_MAP", "CHECKLIST", "REVIEW", "OTHER"].includes(s.supportType) || !s.supportType
                );
                
                const questions = supports.filter((s: any) => 
                  ["QUESTIONS", "COMMENTED_QUESTIONS", "SIMULATED_EXAM"].includes(s.supportType)
                );
                
                const answerKeys = supports.filter((s: any) => 
                  s.supportType === "ANSWER_KEY"
                );

                const renderSupportCard = (support: any) => (
                  <div key={support.id} className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 rounded-2xl border border-border/40 bg-card hover:bg-muted/10 hover:border-accent/20 transition-all">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-accent" />
                        <span className="font-semibold text-foreground">{support.material?.fileName || "Material"}</span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground ml-6 max-w-2xl leading-relaxed">
                        {support.description || getSchemaSupportDescription(support.supportType)}
                      </p>

                      <div className="flex items-center gap-3 ml-6 mt-2 flex-wrap">
                        {support.pageStart && (
                          <span className="text-xs text-muted-foreground font-medium">
                            Páginas {support.pageStart} a {support.pageEnd || support.pageStart}
                          </span>
                        )}
                        {support.pageStart && <span className="text-muted-foreground/30">•</span>}
                        <Badge variant="secondary" className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md font-bold bg-muted/60 text-muted-foreground border-none">
                          {SUPPORT_TYPE_LABELS[support.supportType] || support.supportType || "Outros"}
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-xl shrink-0 gap-1.5 hover:bg-accent/5 hover:text-accent hover:border-accent/20 transition-all font-bold" 
                      onClick={() => {
                        setPdfViewerProps({
                          materialId: support.materialId,
                          pageStart: support.pageStart || 1,
                          pageEnd: support.pageEnd || support.pageStart || 1,
                          title: support.material?.fileName || "Material de Apoio",
                          isSupport: true,
                          description: support.description || getSchemaSupportDescription(support.supportType),
                          supportType: support.supportType || "",
                        });
                        setActiveTab("pdf");
                      }}
                    >
                      Abrir Material
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );

                return (
                  <div className="space-y-6">
                    {/* Seção de Resumos */}
                    {summaries.length > 0 && (
                      <div className="bg-card p-6 rounded-[2rem] border border-border/40 shadow-sm space-y-4">
                        <h3 className="text-lg font-bold text-accent flex items-center gap-2">
                          <Layers className="w-5 h-5" />
                          Teoria Complementar e Resumos
                        </h3>
                        <div className="grid gap-3">
                          {summaries.map(renderSupportCard)}
                        </div>
                      </div>
                    )}

                    {/* Seção de Exercícios */}
                    {questions.length > 0 && (
                      <div className="bg-card p-6 rounded-[2rem] border border-border/40 shadow-sm space-y-4">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <BrainCircuit className="w-5 h-5" />
                          Prática e Questões
                        </h3>
                        <div className="grid gap-3">
                          {questions.map(renderSupportCard)}
                        </div>
                      </div>
                    )}

                    {/* Seção de Gabaritos */}
                    {answerKeys.length > 0 && (
                      <div className="bg-card p-6 rounded-[2rem] border border-border/40 shadow-sm space-y-4">
                        <h3 className="text-lg font-bold text-amber-600 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5" />
                          Gabaritos e Resoluções
                        </h3>
                        <div className="grid gap-3">
                          {answerKeys.map(renderSupportCard)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : activeTab === "pdf" ? (
            <div className="space-y-4 animate-in fade-in duration-500">
              {pdfViewerProps.isSupport && (
                <div className="flex flex-col gap-4 p-5 rounded-2xl border border-amber-100 bg-amber-50/70 text-amber-900 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-sm font-bold text-amber-950">Visualizando Material de Apoio</p>
                        {pdfViewerProps.supportType && (
                          <Badge variant="secondary" className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-800 border-amber-200/50">
                            {SUPPORT_TYPE_LABELS[pdfViewerProps.supportType] || pdfViewerProps.supportType}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-amber-800 pl-6 leading-relaxed">
                        <strong>{pdfViewerProps.title}</strong> {pdfViewerProps.pageStart ? `• Páginas ${pdfViewerProps.pageStart} a ${pdfViewerProps.pageEnd || pdfViewerProps.pageStart}` : ""}
                      </p>
                    </div>
                    <Button 
                      variant="soft" 
                      size="sm" 
                      className="rounded-xl font-bold bg-white text-amber-700 border border-amber-200 shrink-0 hover:bg-amber-100 hover:text-amber-850 transition-colors"
                      onClick={() => {
                        setPdfViewerProps({
                          materialId: block.materialId,
                          pageStart: block.pageStart,
                          pageEnd: block.pageEnd,
                          title: block.title,
                          isSupport: false,
                          description: "",
                          supportType: "",
                        });
                      }}
                    >
                      Voltar para Teoria Principal
                    </Button>
                  </div>
                  {pdfViewerProps.description && (
                    <div className="pl-6 border-l-2 border-amber-200 text-xs text-amber-800 leading-relaxed font-medium">
                      {pdfViewerProps.description}
                    </div>
                  )}
                </div>
              )}
              <PdfBlockViewer 
                materialId={pdfViewerProps.materialId} 
                pageStart={pdfViewerProps.pageStart} 
                pageEnd={pdfViewerProps.pageEnd} 
              />
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {content.length === 0 ? (
                <div className="bg-card p-12 rounded-[2.5rem] border-2 border-dashed border-border/60 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <Info className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg">Texto não disponível</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Não encontramos texto extraído para as páginas deste bloco. Verifique se o processamento do material foi concluído.
                    </p>
                  </div>
                </div>
              ) : (
                content.map((page) => (
                  <section key={page.id} className="bg-white p-10 md:p-16 rounded-[3rem] border border-border/30 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative group transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="absolute top-8 right-10 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em] group-hover:text-accent/40 transition-colors">
                      Página {page.pageNumber}
                    </div>
                    <div className="prose prose-sage max-w-none">
                      <div className="whitespace-pre-wrap leading-[1.8] text-foreground/80 text-[1.05rem] font-medium selection:bg-accent/10 selection:text-accent">
                        {page.text}
                      </div>
                    </div>
                  </section>
                ))
              )}
            </div>
          )}
        </main>

        {/* Sidebar de Ações e Status */}
        <aside className="space-y-6 sticky top-8">
          {/* Ação de Conclusão e IA */}

          <div className="bg-card rounded-[2rem] border border-border/40 p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-accent" />
              {isSecondPass ? "Segunda Leitura" : "Memorização"}
            </h3>
            
            {isSecondPass ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full rounded-2xl gap-2 font-bold shadow-md shadow-accent/15 transition-all hover:scale-[1.02] active:scale-95 py-6 text-sm"
                  onClick={handleCompleteSecondPass}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Concluir Segunda Leitura
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground font-medium leading-relaxed">
                  A segunda leitura será registrada sem alterar o cronograma ou gerar novos flashcards.
                </p>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full rounded-2xl gap-2 font-bold shadow-md shadow-accent/15 transition-all hover:scale-[1.02] active:scale-95 py-6 text-sm"
                  onClick={handleCompleteReading}
                  disabled={isGeneratingCards}
                >
                  {isGeneratingCards ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando Cards...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-current animate-pulse" />
                      Concluir & Gerar Cards
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-2xl gap-2 font-bold h-12 text-xs border-accent/20 text-accent/90 hover:bg-accent/5 hover:text-accent hover:border-accent/30 transition-all flex items-center justify-center"
                  onClick={handleCurationComplete}
                  disabled={isGeneratingCards || isUpdatingStatus}
                >
                  {isUpdatingStatus ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Concluindo...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Concluir sem Gerar Cards
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground font-medium leading-relaxed">
                  Ao concluir a leitura, o cronômetro será pausado. A IA pode gerar novos cards ou você pode concluir sem cards.
                </p>
              </>
            )}
          </div>

          <div className="bg-card rounded-[2rem] border border-border/40 p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
              Navegação
            </h3>
            <div className="flex flex-col gap-2">
              <Button variant="ghost" className="justify-start rounded-xl gap-3 h-11 font-medium hover:bg-accent/5" asChild>
                <Link href={returnTarget.href}>
                  {React.createElement(getReturnIcon(returnTarget.href), { className: "w-4 h-4" })}
                  {returnTarget.label}
                </Link>
              </Button>
              <Button variant="ghost" className="justify-start rounded-xl gap-3 h-11 font-medium hover:bg-accent/5" asChild>
                <Link href={`/materials/${block.materialId}`}>
                  <FileText className="w-4 h-4" />
                  Abrir Material Completo
                </Link>
              </Button>
            </div>
          </div>

          <div className="bg-accent/5 rounded-[2rem] border border-accent/10 p-6 space-y-3">
            <h4 className="text-xs font-bold text-accent uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Tempo Estimado
            </h4>
            <p className="text-sm text-accent/80 leading-relaxed font-medium">
              Este bloco leva cerca de <strong>{block.estimatedStudyMinutes || 30} minutos</strong> para ser lido e compreendido.
            </p>
          </div>
        </aside>
      </div>

      {isIdleAlertOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-[2rem] border border-border/40 p-8 shadow-xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">Você ainda está estudando?</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Pausamos o cronômetro por inatividade para manter seu tempo de estudo real preciso. Clique abaixo para continuar.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full rounded-2xl font-bold shadow-md shadow-accent/15 transition-all hover:scale-[1.02]"
              onClick={handleResumeFromIdle}
            >
              Continuar Estudando
            </Button>
          </div>
        </div>
      )}

      {step === "reading" && (
        <div className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6 w-[210px] bg-background/80 backdrop-blur-xl border border-border/40 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">
              Tempo de Estudo
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black text-foreground tabular-nums leading-none">
                {formatTimer(timeSpent)}
              </span>
              {isTimerRunning && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center shrink-0">
            {startedAt === null ? (
              <Button
                variant="primary"
                size="icon"
                className="w-9 h-9 rounded-xl shadow-sm"
                onClick={() => setIsTimerRunning(true)}
                title="Iniciar Leitura"
              >
                <Play className="w-4 h-4 fill-current" />
              </Button>
            ) : isTimerRunning ? (
              <Button
                variant="outline"
                size="icon"
                className="w-9 h-9 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"
                onClick={() => setIsTimerRunning(false)}
                title="Pausar"
              >
                <Pause className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="icon"
                className="w-9 h-9 rounded-xl shadow-sm"
                onClick={() => setIsTimerRunning(true)}
                title="Retomar"
              >
                <Play className="w-4 h-4 fill-current" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
