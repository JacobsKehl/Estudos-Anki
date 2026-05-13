"use client";

import * as React from "react";
import { FileText, Edit2, Trash2, Loader2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useRouter } from "next/navigation";

interface StudyBlockItemProps {
  block: any;
}

export function StudyBlockItem({ block }: StudyBlockItemProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const [editTitle, setEditTitle] = React.useState(block.title);
  const [editDescription, setEditDescription] = React.useState(block.description || "");
  const [editPageStart, setEditPageStart] = React.useState(block.pageStart);
  const [editPageEnd, setEditPageEnd] = React.useState(block.pageEnd);

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

  return (
    <div 
      className="group bg-card p-5 rounded-[2rem] border border-border/40 flex flex-col gap-3 hover:border-accent/30 transition-all shadow-[0_4px_12px_-4px_rgba(0,0,0,0.02)] cursor-pointer relative"
      onClick={() => router.push(`/blocks/${block.id}`)}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="font-bold text-lg leading-tight text-foreground group-hover:text-accent transition-colors">{block.title}</h3>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 uppercase font-bold tracking-wider">
            <FileText className="w-3 h-3" />
            {block.material?.fileName || "Material Desconhecido"}
          </p>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <div className="text-[10px] font-bold px-3 py-1 bg-sage-light/30 text-accent rounded-full uppercase tracking-wider mr-2">
            {block.status === "NOT_STARTED" ? "Não Iniciado" : block.status === "IN_PROGRESS" ? "Estudando" : "Concluído"}
          </div>
          
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <Button onClick={handleUpdate} disabled={isUpdating} className="rounded-xl bg-accent text-white hover:bg-accent/90 px-8">
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
              onClick={handleDelete} 
              disabled={isDeleting}
              className="w-full rounded-xl bg-red-500 text-white hover:bg-red-600 h-12"
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
