"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Trash2, Eye, RotateCw, Loader2, Sparkles, AlertCircle } from "lucide-react";
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
}

export function MaterialCard({ material }: MaterialCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isOrganizing, setIsOrganizing] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showSubjectDialog, setShowSubjectDialog] = React.useState(false);
  const [subjects, setSubjects] = React.useState<any[]>([]);
  const [isUpdatingSubject, setIsUpdatingSubject] = React.useState(false);
  const [newSubjectName, setNewSubjectName] = React.useState("");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState("");

  const handleOrganize = async () => {
    setIsOrganizing(true);
    const toastId = toast.loading("Iniciando pipeline completo: PDF → Blocos → Flashcards...");
    try {
      const res = await fetch("/api/materials/organize-all", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao organizar material");

      toast.success(data.message, { id: toastId });
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message, { id: toastId });
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleReorganize = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm("Isso removerá os blocos atuais e criará uma nova divisão temática. Deseja continuar?")) return;

    setIsOrganizing(true);
    const toastId = toast.loading("Reorganizando material com IA...");
    try {
      const res = await fetch(`/api/materials/${material.id}/organize`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao reorganizar");

      toast.success("Material reorganizado com sucesso!", { id: toastId });
      router.refresh();
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsOrganizing(false);
    }
  };

  const date = new Date(material.uploadedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

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

  return (
    <Card className="group hover:border-accent/30 transition-colors overflow-hidden h-full flex flex-col">
      <CardContent className="p-0 flex flex-col h-full">
        <div className="p-5 flex flex-col gap-4 flex-grow">
          <div className="flex justify-between items-start gap-4">
            <Link 
              href={`/materials/${material.id}`} 
              className="flex items-start gap-3 flex-grow group/link hover:opacity-80 transition-opacity"
            >
              <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover/link:bg-accent group-hover/link:text-white transition-colors">
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
                  <button 
                    onClick={openSubjectDialog}
                    className="text-[10px] text-accent hover:underline font-bold"
                  >
                    Alterar
                  </button>
                </div>
                {material.organizationStatus === "ERROR" && material.processingError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg flex gap-2 text-[10px] text-red-600 font-medium animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    <p className="leading-tight">{material.processingError}</p>
                  </div>
                )}
              </div>
            </Link>
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
              {material.pageCount} págs • {date}
            </div>
          </div>
        </div>

        <div className="bg-muted/30 px-5 py-3 border-t border-border/50 flex gap-2">
          {material.organizationStatus !== "ORGANIZED" ? (
            <Button 
              size="sm" 
              className="flex-1 rounded-xl h-9 bg-accent text-white hover:bg-accent/90 gap-2 shadow-sm"
              onClick={handleOrganize}
              disabled={isOrganizing}
            >
              {isOrganizing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Organizando...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Organizar</>
              )}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1 rounded-xl h-9 border-accent/20 text-accent hover:bg-accent/5" asChild>
                <Link href={`/materials/${material.id}`}>Ver Blocos</Link>
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                className="flex-1 rounded-xl h-9 text-muted-foreground hover:text-accent gap-2 text-[10px] font-bold uppercase"
                onClick={handleReorganize}
                disabled={isOrganizing}
              >
                {isOrganizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                Reorganizar
              </Button>
            </>
          )}
          
          {material.organizationStatus !== "ORGANIZED" && (
            <Button 
              size="sm" 
              variant="secondary" 
              className="rounded-xl h-9 px-3 gap-2"
              asChild
            >
              <Link href={`/materials/${material.id}`}>
                <Eye className="w-3.5 h-3.5" />
              </Link>
            </Button>
          )}
        </div>

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
      </CardContent>
    </Card>
  );
}

