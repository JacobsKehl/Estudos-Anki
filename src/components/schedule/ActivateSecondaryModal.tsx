"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Loader2, BookOpen, AlertTriangle } from "lucide-react";

interface Subject {
  id: string;
  name: string;
}

interface ActivateSecondaryModalProps {
  secondarySubjects: Subject[];
}

export function ActivateSecondaryModal({ secondarySubjects }: ActivateSecondaryModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleSubject = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === secondarySubjects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(secondarySubjects.map(s => s.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      toast.error("Por favor, selecione ao menos uma matéria.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Adicionando matérias ao cronograma principal...");

    try {
      const response = await fetch("/api/schedule/activate-secondary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds: selectedIds }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Matérias secundárias adicionadas com sucesso!", { id: toastId });
        setIsOpen(false);
        setSelectedIds([]);
        router.refresh();
      } else {
        toast.error(data.error || "Erro ao adicionar matérias.", { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro de conexão ao adicionar matérias.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (secondarySubjects.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="rounded-xl border-accent/30 text-accent hover:bg-accent/5 font-bold gap-1.5 h-10 active:scale-[0.98] transition-transform"
      >
        <Plus className="w-4 h-4" />
        Adicionar matérias secundárias
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-accent" />
                Matérias Secundárias Disponíveis
              </DialogTitle>
              <p className="text-xs text-muted-foreground pt-1 leading-relaxed">
                Estas matérias estão cadastradas na biblioteca, mas ainda não fazem parte do seu ciclo de estudos principal.
              </p>
            </DialogHeader>

            {/* Warning Banner */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/50 text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Ao adicionar essas matérias, o cronograma futuro será reorganizado para reservar tempo para elas. O que você já concluiu será preservado.
              </p>
            </div>

            {/* Selector list */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Matéria ({secondarySubjects.length})
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-accent hover:underline"
                >
                  {selectedIds.length === secondarySubjects.length ? "Desmarcar Todos" : "Selecionar Todos"}
                </button>
              </div>

              <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2 scrollbar-thin">
                {secondarySubjects.map((sub) => {
                  const isChecked = selectedIds.includes(sub.id);
                  return (
                    <div
                      key={sub.id}
                      onClick={() => handleToggleSubject(sub.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                        isChecked 
                          ? "border-accent/40 bg-accent/5" 
                          : "border-border/50 hover:border-border/80 bg-background"
                      }`}
                    >
                      <span className="text-sm font-semibold text-foreground">{sub.name}</span>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                        isChecked 
                          ? "bg-accent border-accent text-accent-foreground" 
                          : "border-border bg-background"
                      }`}>
                        {isChecked && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsOpen(false);
                  setSelectedIds([]);
                }}
                disabled={isSubmitting}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-accent text-accent-foreground font-bold active:scale-[0.98] transition-transform"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  "Adicionar ao cronograma"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
