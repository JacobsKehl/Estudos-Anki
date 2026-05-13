"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Trash2, Eye, RotateCw, Loader2, Sparkles } from "lucide-react";
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

  const handleOrganize = async () => {
    setIsOrganizing(true);
    const toastId = toast.loading("Analisando estrutura do PDF com IA...");
    try {
      const res = await fetch(`/api/materials/${material.id}/organize`, {
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
        return { 
          label: "Organizado", 
          variant: "success" as const,
          subLabel: `${material.blocksCount || 0} blocos criados`
        };
      case "ANALYZING":
      case "EXTRACTING":
        return { 
          label: "Organizando...", 
          variant: "default" as const,
          subLabel: "IA em ação"
        };
      case "ERROR":
        return { 
          label: "Erro", 
          variant: "destructive" as const,
          subLabel: "Falha na análise"
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
                <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  {material.subjectName}
                </p>
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
          {material.organizationStatus !== "ORGANIZED" && (
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
          )}
          
          <Button 
            size="sm" 
            variant="secondary" 
            className={`rounded-xl h-9 gap-2 ${material.organizationStatus === "ORGANIZED" ? "flex-1" : "px-3"}`}
            asChild
          >
            <Link href={`/materials/${material.id}`}>
              <Eye className="w-3.5 h-3.5" />
              {material.organizationStatus === "ORGANIZED" ? "Abrir Material" : ""}
            </Link>
          </Button>
        </div>

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
      </CardContent>
    </Card>
  );
}

