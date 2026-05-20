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
  Info,
  Play,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GenerateFlashcardsButton } from "../subjects/GenerateFlashcardsButton";
import { PdfBlockViewer } from "./PdfBlockViewer";

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
      return "Gabarito de conferência oficial para rápida verificação e validação das respostas dos respostas.";
    default:
      return "Material complementar de apoio pedagógico focado em potencializar seu aprendizado e fixação.";
  }
};

interface BlockStudyViewProps {
  block: any;
  content: any[];
  stats: {
    total: number;
    pending: number;
    approved: number;
  };
}

export function BlockStudyView({ block, content, stats }: BlockStudyViewProps) {
  const router = useRouter();
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
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

  const updateStatus = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      if (newStatus === "COMPLETED") {
        const res = await fetch(`/api/study-blocks/${block.id}/complete-step`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "THEORY" }), // Mark theory as complete which triggers the whole block completion logic
        });
        if (!res.ok) throw new Error("Erro ao completar bloco");
        const data = await res.json();
        toast.success(data.message || "Bloco concluído! Parabéns pelos estudos.");
      } else {
        const res = await fetch(`/api/blocks/${block.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("Erro ao atualizar status");
        toast.success("Status atualizado");
      }
      router.refresh();
    } catch {
      toast.error("Erro ao atualizar o status do bloco");
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

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32 animate-in fade-in duration-700">
      {/* Header Focado */}
      <header className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="iconOnly" className="rounded-full hover:bg-accent/5" asChild>
            <Link href={`/subjects/${block.subjectId}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <Link href={`/subjects/${block.subjectId}`} className="hover:text-accent transition-colors">
              {block.subject.name}
            </Link>
            <ChevronRight className="w-4 h-4 opacity-30" />
            <span className="text-foreground/60">Bloco de Estudo</span>
          </div>
        </div>

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

          <div className="flex items-center gap-3">
            {block.status !== "COMPLETED" ? (
              <Button 
                variant="primary"
                size="lg"
                onClick={() => updateStatus("COMPLETED")} 
                disabled={isUpdatingStatus}
                className="rounded-2xl gap-2 font-bold transition-all active:scale-95"
              >
                {isUpdatingStatus ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Marcar como estudado
              </Button>
            ) : (
              <Button 
                variant="soft"
                size="lg"
                onClick={() => updateStatus("IN_PROGRESS")} 
                disabled={isUpdatingStatus}
                className="rounded-2xl gap-2 font-bold"
              >
                Retomar estudo
              </Button>
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
                      
                      {/* Breve descrição do material de apoio */}
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
          <div className="bg-card rounded-[2rem] border border-border/40 p-6 space-y-6 shadow-sm">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-accent" />
              Memorização
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                  <p className="text-[10px] uppercase font-bold text-accent/60 tracking-wider mb-1">Aprovados</p>
                  <p className="text-2xl font-black text-accent">{stats.approved}</p>
                </div>
                <div className="bg-muted/30 p-4 rounded-2xl border border-border/40">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider mb-1">Pendentes</p>
                  <p className="text-2xl font-black text-foreground/70">{stats.pending}</p>
                </div>
              </div>

              {stats.pending > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-amber-700">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed font-medium">
                    Você tem <strong>{stats.pending} cards</strong> aguardando curadoria.
                  </p>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-3">
                {stats.approved > 0 && (
                  <Button variant="primary" size="lg" className="w-full rounded-2xl gap-2 font-bold shadow-md shadow-accent/20 transition-all hover:scale-[1.02]" asChild>
                    <Link href={`/practice?blockId=${block.id}`}>
                      <Play className="w-4 h-4 fill-current" />
                      Praticar cards
                    </Link>
                  </Button>
                )}
                
                <GenerateFlashcardsButton blockId={block.id} hasFlashcards={stats.total > 0} />
                
                {stats.total > 0 && (
                  <Button variant="ghost" className="w-full rounded-xl gap-2 h-11 text-muted-foreground hover:text-accent hover:bg-accent/5" asChild>
                    <Link href={`/flashcards?blockId=${block.id}`}>
                      <ExternalLink className="w-4 h-4" />
                      Repositório de cards
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-[2rem] border border-border/40 p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
              Navegação
            </h3>
            <div className="flex flex-col gap-2">
              <Button variant="ghost" className="justify-start rounded-xl gap-3 h-11 font-medium hover:bg-accent/5" asChild>
                <Link href={`/subjects/${block.subjectId}`}>
                  <BookOpen className="w-4 h-4" />
                  Voltar para Matéria
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
    </div>
  );
}
