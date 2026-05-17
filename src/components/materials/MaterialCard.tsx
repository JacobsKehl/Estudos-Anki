"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Trash2, Eye, RotateCw, Loader2, Sparkles, AlertCircle, Brain, BookOpen, ChevronDown } from "lucide-react";
import { MaterialStatusBadge } from "./MaterialStatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { toast } from "sonner";


interface MaterialCardProps {
  material: {
    id: string;
    title: string;
    subjectName: string;
    status: "PENDING" | "PROCESSING" | "PROCESSED" | "ERROR";
    organizationStatus: string;
    processingError?: string | null;
    pageCount: number;
    extractedWords: number;
    uploadedAt: string;
    hasExistingBlocks?: boolean;
    blocksCount?: number;
  };
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  isSelectionMode?: boolean;
}

export function MaterialCard({ 
  material, 
  isSelected = false, 
  onSelect, 
  isSelectionMode = false 
}: MaterialCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isOrganizing, setIsOrganizing] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showSubjectDialog, setShowSubjectDialog] = React.useState(false);
  const [subjects, setSubjects] = React.useState<any[]>([]);
  const [isUpdatingSubject, setIsUpdatingSubject] = React.useState(false);
  const [newSubjectName, setNewSubjectName] = React.useState("");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState("");

  const [showActionsDialog, setShowActionsDialog] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);

  const executeOrganizationAction = async (mode: string) => {
    setIsOrganizing(true);
    setShowActionsDialog(false);
    
    let loadingMsg = "Processando requisição...";
    if (mode === "general") loadingMsg = "Iniciando pipeline completo: PDF → Blocos → Flashcards...";
    if (mode === "content_only") loadingMsg = "Analisando estrutura e criando blocos temáticos...";
    if (mode === "flashcards_only") loadingMsg = "Gerando flashcards com IA para os blocos...";
    if (mode === "clear_flashcards") loadingMsg = "Excluindo flashcards deste material...";
    if (mode === "unorganize") loadingMsg = "Apagando blocos e chaves de estudo do zero...";

    const toastId = toast.loading(loadingMsg);
    try {
      const res = await fetch(`/api/materials/${material.id}/organize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao realizar ação");

      toast.success(data.message || "Ação realizada com sucesso!", { id: toastId });
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro desconhecido", { 
        id: toastId,
        duration: 8000
      });
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleOrganizeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowActionsDialog(true);
  };

  const handleReorganizeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowActionsDialog(true);
  };

  const [formattedDate, setFormattedDate] = React.useState("");

  React.useEffect(() => {
    try {
      const parsedDate = new Date(material.uploadedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });
      setFormattedDate(parsedDate);
    } catch (e) {
      setFormattedDate("");
    }
  }, [material.uploadedAt]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/materials/${material.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Erro ao excluir material");

      toast.success("Material excluído com sucesso");
      setShowDeleteDialog(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível excluir o material");
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusInfo = () => {
    switch (material.organizationStatus) {
      case "ORGANIZED":
        const isGeneric = material.blocksCount === 1;
        return { 
          label: isGeneric ? "Revisar Divisão" : "Organizado", 
          variant: isGeneric ? "outline" as const : "success" as const,
          subLabel: isGeneric ? "Apenas 1 bloco detectado" : `${material.blocksCount || 0} blocos + flashcards`
        };
      case "EXTRACTING":
        return { 
          label: "Extraindo texto", 
          variant: "default" as const,
          subLabel: "Lendo páginas do PDF"
        };
      case "ANALYZING":
        return { 
          label: "Analisando IA", 
          variant: "default" as const,
          subLabel: "Identificando estrutura"
        };
      case "GENERATING_FLASHCARDS":
        return { 
          label: "Gerando Cards", 
          variant: "default" as const,
          subLabel: "Criando flashcards Q&A"
        };
      case "IMPORTED":
        return { 
          label: "Aguardando IA", 
          variant: "secondary" as const,
          subLabel: "Pronto para organizar"
        };
      case "ERROR":
        return { 
          label: "Erro", 
          variant: "destructive" as const,
          subLabel: "Falha no processo"
        };
      default:
        return { 
          label: "Importado", 
          variant: "secondary" as const,
          subLabel: "Aguardando organização"
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handleUpdateSubject = async () => {
    setIsUpdatingSubject(true);
    try {
      const res = await fetch(`/api/materials/${material.id}/update-subject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          subjectId: selectedSubjectId === "NEW" ? null : selectedSubjectId,
          subjectName: selectedSubjectId === "NEW" ? newSubjectName : null
        }),
      });

      if (!res.ok) throw new Error("Erro ao atualizar matéria");

      toast.success("Matéria atualizada com sucesso!");
      setShowSubjectDialog(false);
      router.refresh();
    } catch (error) {
      toast.error("Erro ao atualizar matéria");
    } finally {
      setIsUpdatingSubject(false);
    }
  };

  const openSubjectDialog = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSubjectDialog(true);
    try {
      const res = await fetch("/api/subjects");
      const data = await res.json();
      setSubjects(data);
      if (data.length > 0) {
        const current = data.find((s: any) => s.name === material.subjectName);
        if (current) setSelectedSubjectId(current.id);
      }
    } catch (err) {
      console.error("Erro ao buscar matérias", err);
    }
  };

  const ContentContainer = isSelectionMode ? "div" : Link;
  const containerProps = isSelectionMode 
    ? { className: "flex items-start gap-3 flex-grow select-none cursor-pointer" }
    : { href: `/materials/${material.id}`, className: "flex items-start gap-3 flex-grow group/link hover:opacity-80 transition-opacity" };

  return (
    <Card 
      onClick={() => isSelectionMode && onSelect && onSelect(material.id)}
      className={`group hover:border-accent/30 transition-all duration-300 overflow-hidden h-full flex flex-col ${
        isSelectionMode 
          ? isSelected 
            ? "border-accent ring-2 ring-accent/20 bg-accent/[0.02]" 
            : "cursor-pointer hover:bg-muted/10" 
          : ""
      }`}
    >
      <CardContent className="p-0 flex flex-col h-full">
        <div className="p-5 flex flex-col gap-4 flex-grow">
          <div className="flex justify-between items-start gap-4">
            <ContentContainer {...(containerProps as any)}>
              <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isSelectionMode && isSelected
                  ? "bg-accent text-white"
                  : "bg-accent/10 text-accent group-hover/link:bg-accent group-hover/link:text-white"
              }`}>
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground line-clamp-2 leading-tight group-hover/link:text-accent transition-colors">
                  {material.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {material.subjectName}
                  </p>
                  {!isSelectionMode && (
                    <button 
                      onClick={openSubjectDialog}
                      className="text-[10px] text-accent hover:underline font-bold"
                    >
                      Alterar
                    </button>
                  )}
                </div>
                {material.organizationStatus === "ERROR" && material.processingError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg flex gap-2 text-[10px] text-red-600 font-medium animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    <p className="leading-tight">{material.processingError}</p>
                  </div>
                )}
              </div>
            </ContentContainer>
            
            {isSelectionMode ? (
              <div 
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 mt-1 ${
                  isSelected 
                    ? "bg-accent border-accent text-white" 
                    : "border-border bg-background group-hover:border-accent/40"
                }`}
              >
                {isSelected && (
                  <svg className="w-3.5 h-3.5 stroke-current stroke-[3] fill-none animate-in zoom-in-50 duration-200" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            ) : (
              <Button 
                variant="ghost" 
                size="icon" 
                className="flex-shrink-0 -mr-2 -mt-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/20">
            <div className="flex flex-col gap-1">
              <Badge variant={statusInfo.variant} className="rounded-full h-5 px-2 text-[10px] uppercase font-bold w-fit">
                {statusInfo.label}
              </Badge>
              <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight ml-1">
                {statusInfo.subLabel}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground font-medium text-right">
              {material.pageCount} págs{formattedDate ? ` • ${formattedDate}` : ""}
            </div>
          </div>
        </div>

        {!isSelectionMode && (
          <div className="bg-muted/30 border-t border-border/50 flex flex-col relative w-full">
            <div className="px-5 py-3 flex gap-2 w-full">
              {material.organizationStatus !== "ORGANIZED" ? (
                <>
                  <Button 
                    size="sm" 
                    className="flex-grow rounded-xl h-9 bg-accent text-white hover:bg-accent/90 gap-2 shadow-sm animate-pulse-subtle"
                    onClick={handleOrganizeClick}
                    disabled={isOrganizing}
                  >
                    {isOrganizing ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5 animate-pulse" /> Organizar</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-9 px-3 text-muted-foreground hover:text-accent hover:border-accent flex items-center gap-1.5 font-bold text-xs"
                    onClick={handleOrganizeClick}
                    disabled={isOrganizing}
                  >
                    <ChevronDown className="w-4 h-4" />
                    Opções
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="flex-grow rounded-xl h-9 border-accent/20 text-accent hover:bg-accent/5 font-bold text-xs" asChild>
                    <Link href={`/materials/${material.id}`}>Ver Blocos</Link>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="rounded-xl h-9 px-3 text-muted-foreground hover:text-accent gap-1.5 text-[10px] font-bold uppercase transition-colors"
                    onClick={handleReorganizeClick}
                    disabled={isOrganizing}
                  >
                    {isOrganizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                    Opções
                  </Button>
                </>
              )}
              
              {material.organizationStatus !== "ORGANIZED" && (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="rounded-xl h-9 px-3 gap-2 hover:bg-muted"
                  asChild
                >
                  <Link href={`/materials/${material.id}`}>
                    <Eye className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Dialog de Exclusão */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir Material?</DialogTitle>
              <p className="text-muted-foreground text-sm mt-2">
                Esta ação é permanente. Todos os blocos de estudo e flashcards vinculados a este material também serão removidos.
              </p>
            </DialogHeader>
            <DialogFooter className="gap-3 sm:gap-0 mt-4">
              <Button variant="ghost" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                Cancelar
              </Button>
              <Button 
                onClick={handleDelete} 
                disabled={isDeleting}
                className="bg-red-500 text-white hover:bg-red-600"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Alterar Matéria */}
        <Dialog open={showSubjectDialog} onOpenChange={setShowSubjectDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Alterar Matéria</DialogTitle>
              <p className="text-muted-foreground text-sm mt-1">
                Isso atualizará o material, todos os seus blocos e flashcards.
              </p>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Selecionar Matéria</label>
                <select 
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                >
                  <option value="">Selecione uma matéria...</option>
                  {subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  <option value="NEW">+ Criar nova matéria...</option>
                </select>
              </div>

              {selectedSubjectId === "NEW" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Nome da Nova Matéria</label>
                  <input 
                    type="text"
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Ex: Direito Civil"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowSubjectDialog(false)} disabled={isUpdatingSubject}>
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateSubject} 
                disabled={isUpdatingSubject || (!selectedSubjectId) || (selectedSubjectId === "NEW" && !newSubjectName)}
                className="bg-accent text-white"
              >
                {isUpdatingSubject ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Atualizar Matéria
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Ações de Organização Granular */}
        <Dialog open={showActionsDialog} onOpenChange={setShowActionsDialog}>
          <DialogContent className="max-w-2xl bg-card border border-border/80 shadow-2xl rounded-2xl p-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="w-5 h-5 text-accent animate-pulse" />
                Opções de Organização com IA
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Escolha o nível de processamento e organização para o material: <span className="font-bold text-accent">{material.title}</span>.
              </p>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
              {/* Opção Completa / Geral */}
              <button
                onClick={() => executeOrganizationAction("general")}
                disabled={isOrganizing}
                className="flex items-start gap-4 p-4 rounded-xl border border-accent/20 bg-accent/[0.02] hover:bg-accent/[0.06] hover:border-accent/40 text-left transition-all duration-300 group"
              >
                <div className="mt-1 shrink-0 p-2.5 rounded-lg bg-accent text-white group-hover:scale-110 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-accent transition-colors flex items-center gap-2">
                    Opção Geral (Completa)
                    <Badge className="bg-accent text-white text-[9px] px-1.5 py-0 h-4">Recomendado</Badge>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
                    Pipeline completo. Lê o PDF, cria blocos de estudos temáticos e gera flashcards para o Anki integrados.
                  </p>
                </div>
              </button>

              {/* Opção Apenas Conteúdo */}
              <button
                onClick={() => executeOrganizationAction("content_only")}
                disabled={isOrganizing}
                className="flex items-start gap-4 p-4 rounded-xl border border-border hover:bg-muted/30 hover:border-accent/30 text-left transition-all duration-300 group"
              >
                <div className="mt-1 shrink-0 p-2.5 rounded-lg bg-cyan-500 text-white group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-cyan-500 transition-colors">
                    Organizar Apenas Conteúdo
                  </h4>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
                    Cria os blocos de estudo temáticos mapeando os tópicos do PDF, mas <strong>não</strong> gera os flashcards.
                  </p>
                </div>
              </button>

              {/* Opção Apenas Flashcards */}
              <button
                onClick={() => executeOrganizationAction("flashcards_only")}
                disabled={isOrganizing}
                className="flex items-start gap-4 p-4 rounded-xl border border-border hover:bg-muted/30 hover:border-accent/30 text-left transition-all duration-300 group"
              >
                <div className="mt-1 shrink-0 p-2.5 rounded-lg bg-emerald-500 text-white group-hover:scale-110 transition-transform">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-emerald-500 transition-colors">
                    Gerar Apenas Flashcards
                  </h4>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
                    Gera flashcards da IA baseados nos blocos temáticos já existentes. Ideal para completar uma organização pendente.
                  </p>
                </div>
              </button>

              {/* Opção Apagar Flashcards */}
              <button
                onClick={() => executeOrganizationAction("clear_flashcards")}
                disabled={isOrganizing}
                className="flex items-start gap-4 p-4 rounded-xl border border-border hover:bg-amber-500/[0.02] hover:border-amber-500/30 text-left transition-all duration-300 group"
              >
                <div className="mt-1 shrink-0 p-2.5 rounded-lg bg-amber-500 text-white group-hover:scale-110 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-amber-500 transition-colors">
                    Apagar Apenas Flashcards
                  </h4>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
                    Remove todos os flashcards criados para este material, mantendo a divisão de blocos de estudo intacta.
                  </p>
                </div>
              </button>
            </div>

            {/* Divisória para opção destrutiva */}
            <div className="border-t border-border/80 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-2.5 items-start">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h5 className="text-xs font-bold text-foreground">Resetar do Zero?</h5>
                  <p className="text-[10px] text-muted-foreground">Isso remove permanentemente toda a divisão de blocos e cards.</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => executeOrganizationAction("unorganize")}
                disabled={isOrganizing}
                className="rounded-xl px-4 gap-2 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 text-red-500 shrink-0 h-9 font-semibold text-xs transition-all"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Desorganizar Conteúdo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

