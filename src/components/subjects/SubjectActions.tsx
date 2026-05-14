"use client";

import * as React from "react";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Archive,
  GitMerge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SubjectActionsProps {
  subject: {
    id: string;
    name: string;
    description: string | null;
  };
  allSubjects?: { id: string; name: string }[];
}

export function SubjectActions({ subject, allSubjects = [] }: SubjectActionsProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Edit State
  const [name, setName] = React.useState(subject.name);
  const [description, setDescription] = React.useState(subject.description || "");

  // Delete impact state
  const [deleteImpact, setDeleteImpact] = React.useState<{
    materials: number; blocks: number; flashcards: number; scheduleItems: number;
  } | null>(null);

  // Merge state
  const [targetSubjectId, setTargetSubjectId] = React.useState("");

  // Close menu on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/subjects/${subject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error();
      toast.success("Matéria atualizada com sucesso");
      setIsEditDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Erro ao atualizar matéria");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async () => {
    setMenuOpen(false);
    setIsLoading(true);
    setDeleteImpact(null);
    try {
      const res = await fetch(`/api/subjects/${subject.id}`, { method: "DELETE" });
      if (res.status === 409) {
        const data = await res.json();
        setDeleteImpact(data.impact);
        setIsDeleteDialogOpen(true);
      } else if (res.ok) {
        toast.success("Matéria excluída com sucesso");
        router.refresh();
      } else {
        throw new Error();
      }
    } catch {
      toast.error("Erro ao verificar dependências da matéria.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!targetSubjectId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/subjects/${subject.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSubjectId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(data.message);
      setIsMergeDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Erro ao mesclar matérias.");
    } finally {
      setIsLoading(false);
    }
  };

  const otherSubjects = allSubjects.filter(s => s.id !== subject.id);

  return (
    <div onClick={(e) => e.stopPropagation()} className="relative" ref={menuRef}>
      {/* Trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full hover:bg-muted/50 transition-colors"
        onClick={() => setMenuOpen(o => !o)}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        )}
      </Button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="absolute right-0 top-9 z-50 w-44 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors text-foreground"
            onClick={() => { setMenuOpen(false); setIsEditDialogOpen(true); }}
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            Editar
          </button>

          {otherSubjects.length > 0 && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors text-foreground"
              onClick={() => { setMenuOpen(false); setTargetSubjectId(""); setIsMergeDialogOpen(true); }}
            >
              <GitMerge className="w-3.5 h-3.5 text-muted-foreground" />
              Mesclar com...
            </button>
          )}

          <div className="h-px bg-border/40 my-1" />

          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-red-50 transition-colors text-red-600"
            onClick={handleDeleteClick}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir
          </button>
        </div>
      )}

      {/* ── Edit Dialog ─────────────────────────────── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md rounded-[2rem] border-border/40 p-0 overflow-hidden shadow-2xl">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold tracking-tight">Editar Matéria</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest ml-1">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="flex h-12 w-full rounded-2xl border border-border/40 bg-muted/20 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest ml-1">Descrição (Opcional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="flex min-h-[100px] w-full rounded-2xl border border-border/40 bg-muted/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all resize-none"
                />
              </div>
              <DialogFooter className="pt-4 flex gap-3">
                <Button type="button" variant="ghost" className="rounded-xl flex-1 h-11" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading || !name.trim()} className="rounded-xl flex-1 h-11 bg-accent text-white hover:bg-accent/90 shadow-md">
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete / Impact Dialog ───────────────────── */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md rounded-[2rem] border-border/40 p-0 overflow-hidden shadow-2xl">
          <div className="p-8 space-y-5">
            <DialogHeader>
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight">Não é possível excluir</DialogTitle>
              <p className="text-muted-foreground text-sm leading-relaxed pt-1">
                Esta matéria tem dados vinculados. Exclua ou transfira os itens antes de prosseguir, ou arquive a matéria para ocultar sem perder o histórico.
              </p>
            </DialogHeader>

            {deleteImpact && (
              <div className="grid grid-cols-2 gap-3">
                {deleteImpact.materials > 0 && (
                  <div className="bg-muted/30 rounded-2xl p-4">
                    <p className="text-2xl font-black text-foreground">{deleteImpact.materials}</p>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Material(is)</p>
                  </div>
                )}
                {deleteImpact.blocks > 0 && (
                  <div className="bg-muted/30 rounded-2xl p-4">
                    <p className="text-2xl font-black text-foreground">{deleteImpact.blocks}</p>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Bloco(s)</p>
                  </div>
                )}
                {deleteImpact.flashcards > 0 && (
                  <div className="bg-muted/30 rounded-2xl p-4">
                    <p className="text-2xl font-black text-foreground">{deleteImpact.flashcards}</p>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Flashcard(s)</p>
                  </div>
                )}
                {deleteImpact.scheduleItems > 0 && (
                  <div className="bg-muted/30 rounded-2xl p-4">
                    <p className="text-2xl font-black text-foreground">{deleteImpact.scheduleItems}</p>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">No cronograma</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex gap-3 pt-2">
              <Button variant="ghost" className="rounded-xl flex-1 h-11" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="rounded-xl flex-1 h-11 bg-amber-500 text-white hover:bg-amber-600 gap-2"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  toast.info("Funcionalidade de arquivamento em breve.");
                }}
              >
                <Archive className="w-4 h-4" />
                Entendido
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Merge Dialog ─────────────────────────────── */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent className="max-w-md rounded-[2rem] border-border/40 p-0 overflow-hidden shadow-2xl">
          <div className="p-8 space-y-5">
            <DialogHeader>
              <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-4">
                <GitMerge className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight">Mesclar Matéria</DialogTitle>
              <p className="text-muted-foreground text-sm leading-relaxed pt-1">
                Todos os materiais, blocos e flashcards de{" "}
                <strong>&quot;{subject.name}&quot;</strong>{" "}
                serão movidos para a matéria de destino.
              </p>
            </DialogHeader>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest ml-1">Mesclar em...</label>
              <select
                value={targetSubjectId}
                onChange={e => setTargetSubjectId(e.target.value)}
                className="flex h-12 w-full rounded-2xl border border-border/40 bg-muted/20 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              >
                <option value="">Selecione a matéria de destino</option>
                {otherSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <DialogFooter className="flex gap-3 pt-2">
              <Button variant="ghost" className="rounded-xl flex-1 h-11" onClick={() => setIsMergeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!targetSubjectId || isLoading}
                onClick={handleMerge}
                className="rounded-xl flex-1 h-11 bg-accent text-white hover:bg-accent/90 shadow-md gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <GitMerge className="w-4 h-4" />
                Mesclar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
