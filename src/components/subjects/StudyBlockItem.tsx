"use client";

import * as React from "react";
import { FileText, Edit2, Trash2, Loader2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GenerateFlashcardsButton } from "./GenerateFlashcardsButton";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ConfettiParticle {
  id: number;
  cx: number;
  cy: number;
  cr: number;
  color: string;
}

interface StudyBlockItemProps {
  block: any;
}

export function StudyBlockItem({ block }: StudyBlockItemProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const [editTitle, setEditTitle] = React.useState(block.title);
  const [editDescription, setEditDescription] = React.useState(block.description || "");
  const [editPageStart, setEditPageStart] = React.useState(block.pageStart);
  const [editPageEnd, setEditPageEnd] = React.useState(block.pageEnd);

  const [status, setStatus] = React.useState(block.status);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [confettiParticles, setConfettiParticles] = React.useState<ConfettiParticle[]>([]);

  React.useEffect(() => {
    setStatus(block.status);
  }, [block.status]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/blocks/${block.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao excluir bloco");
      toast.success("Bloco excluído com sucesso");
      router.refresh();
    } catch (error) {
      toast.error("Não foi possível excluir o bloco");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          pageStart: editPageStart,
          pageEnd: editPageEnd,
        }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar bloco");
      toast.success("Bloco atualizado!");
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast.error("Erro ao atualizar bloco");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    
    const newStatus = status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED";
    
    // Optimistic UI update
    setStatus(newStatus);
    if (newStatus === "COMPLETED") {
      const newParticles = Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360 + (Math.random() - 0.5) * 20;
        const distance = 30 + Math.random() * 40;
        const cx = Math.cos((angle * Math.PI) / 180) * distance;
        const cy = Math.sin((angle * Math.PI) / 180) * distance;
        const cr = Math.random() * 360;
        const colors = ["#789461", "#8fb973", "#34d399", "#059669", "#fbbf24", "#e2c79f"];
        const color = colors[i % colors.length];
        return { id: i, cx, cy, cr, color };
      });
      setConfettiParticles(newParticles);
      setShowConfetti(true);
      setTimeout(() => {
        setShowConfetti(false);
        setConfettiParticles([]);
      }, 800);
    }
    
    try {
      const res = await fetch(`/api/blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!res.ok) throw new Error("Erro ao atualizar status");
      
      toast.success(newStatus === "COMPLETED" ? "Bloco concluído! 🎉" : "Bloco reaberto");
      router.refresh();
    } catch (error) {
      // Revert on failure
      setStatus(status);
      setConfettiParticles([]);
      setShowConfetti(false);
      toast.error("Erro ao atualizar status do bloco");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div 
      className="group bg-card p-5 rounded-[2rem] border border-border/40 flex flex-col gap-3 hover:border-accent/30 transition-all shadow-[0_4px_12px_-4px_rgba(0,0,0,0.02)] cursor-pointer relative"
      onClick={() => router.push(`/blocks/${block.id}?returnTo=${encodeURIComponent(pathname)}`)}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="font-bold text-lg leading-tight text-foreground group-hover:text-accent transition-colors">{block.title}</h3>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 uppercase font-bold tracking-wider">
            <FileText className="w-3 h-3" />
            {block.material?.fileName || "Material Desconhecido"}
          </p>
        </div>
        <div className="flex items-center gap-1 relative overflow-visible" onClick={e => e.stopPropagation()}>
          <style>{`
            @keyframes draw {
              to {
                stroke-dashoffset: 0;
              }
            }
            .checkmark-path {
              stroke-dasharray: 22;
              stroke-dashoffset: 22;
              animation: draw 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.05s forwards;
            }
            @keyframes confetti-shoot {
              0% {
                transform: translate(-50%, -50%) translate(0, 0) scale(1.2);
                opacity: 1;
              }
              100% {
                transform: translate(-50%, -50%) translate(var(--cx), var(--cy)) rotate(var(--cr)) scale(0);
                opacity: 0;
              }
            }
            .confetti-particle {
              position: absolute;
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background-color: var(--cbg);
              animation: confetti-shoot 0.75s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
              pointer-events: none;
            }
          `}</style>

          <button
            onClick={handleToggleStatus}
            disabled={isUpdatingStatus}
            title={status === "COMPLETED" ? "Desmarcar conclusão" : "Concluir bloco"}
            className={cn(
              "text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider mr-2 transition-all duration-300 flex items-center gap-1 relative overflow-visible select-none active:scale-95",
              status === "COMPLETED"
                ? "bg-success-bg text-success-text hover:bg-success-bg/85 hover:scale-105 hover:shadow-[0_4px_12px_rgba(52,211,153,0.15)] cursor-pointer"
                : status === "IN_PROGRESS"
                ? "bg-warning-bg text-warning-text hover:bg-warning-bg/85 hover:scale-105 cursor-pointer"
                : "bg-sage-light/30 text-accent hover:bg-sage-light/45 hover:scale-105 hover:shadow-[0_4px_12px_rgba(120,148,97,0.12)] cursor-pointer"
            )}
          >
            {isUpdatingStatus ? (
              <Loader2 className="w-3 h-3 animate-spin text-accent" />
            ) : status === "COMPLETED" ? (
              <svg
                className="w-3 h-3 text-success-text shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" className="checkmark-path" />
              </svg>
            ) : null}
            <span>{status === "COMPLETED" ? "Concluído" : status === "IN_PROGRESS" ? "Estudando" : "Não Iniciado"}</span>

            {/* Confetti Explosion particles */}
            {showConfetti && confettiParticles.map((p) => (
              <div
                key={p.id}
                className="confetti-particle"
                style={{
                  "--cx": `${p.cx}px`,
                  "--cy": `${p.cy}px`,
                  "--cr": `${p.cr}deg`,
                  "--cbg": p.color,
                  left: "50%",
                  top: "50%",
                } as React.CSSProperties}
              />
            ))}
          </button>
          
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {block.confidence && block.confidence < 0.5 && (
              <Badge variant="outline" className="h-8 border-orange-200 bg-orange-50 text-orange-600 text-[10px] font-bold uppercase rounded-xl px-3 mr-1">
                Divisão Provisória
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full hover:bg-accent/10 hover:text-accent"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full hover:bg-red-50 hover:text-red-500"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {block.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {block.description}
        </p>
      )}
      
      <div className="flex items-center justify-between gap-4 text-sm mt-2 pt-4 border-t border-border/30">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-bold text-accent/80 bg-accent/5 px-3 py-1 rounded-full text-xs w-fit">
              Págs {block.pageStart} a {block.pageEnd}
            </span>
            {block._count?.flashcards > 0 && (
              <span className="text-[10px] text-muted-foreground font-medium px-1">
                {block._count.flashcards} flashcards gerados
              </span>
            )}
          </div>
          {block.estimatedStudyMinutes && (
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Loader2 className="w-3 h-3" />
              {block.estimatedStudyMinutes} min
            </span>
          )}
        </div>
        <div onClick={e => e.stopPropagation()}>
          <GenerateFlashcardsButton 
            blockId={block.id} 
            hasFlashcards={block._count?.flashcards > 0} 
          />
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Editar Bloco</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Título</label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="rounded-2xl h-12" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Descrição</label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="rounded-2xl min-h-[100px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Pág. Inicial</label>
                <Input type="number" value={editPageStart} onChange={e => setEditPageStart(parseInt(e.target.value))} className="rounded-2xl h-12" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Pág. Final</label>
                <Input type="number" value={editPageEnd} onChange={e => setEditPageEnd(parseInt(e.target.value))} className="rounded-2xl h-12" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-0 mt-6">
            <Button variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl">Cancelar</Button>
            <Button variant="primary" onClick={handleUpdate} disabled={isUpdating} className="rounded-xl px-8">
              {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm rounded-[2.5rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">Excluir Bloco?</DialogTitle>
            <p className="text-sm text-center text-muted-foreground mt-2">
              Você tem certeza que deseja remover este bloco de estudo? Esta ação não pode ser desfeita.
            </p>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-3 sm:gap-3 mt-8">
            <Button 
              variant="destructive"
              size="lg"
              onClick={handleDelete} 
              disabled={isDeleting}
              className="w-full rounded-xl"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir permanentemente
            </Button>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="w-full rounded-xl h-12">
              Manter bloco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
