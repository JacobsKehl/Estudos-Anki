"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CreateStudyBlockDialog({ subjectId, materials, trigger }: { subjectId: string, materials: any[], trigger?: React.ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  
  const [title, setTitle] = React.useState("");
  const [materialId, setMaterialId] = React.useState(materials.length > 0 ? materials[0].id : "");
  const [pageStart, setPageStart] = React.useState<number | "">("");
  const [pageEnd, setPageEnd] = React.useState<number | "">("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !materialId || pageStart === "" || pageEnd === "") return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          subjectId, 
          materialId, 
          title, 
          pageStart: Number(pageStart), 
          pageEnd: Number(pageEnd) 
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erro ao criar bloco");
      }

      setIsOpen(false);
      setTitle("");
      setPageStart("");
      setPageEnd("");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (materials.length === 0) {
    return (
      <Button disabled variant="outline" className="rounded-xl gap-2 font-medium">
        Adicione materiais primeiro
      </Button>
    );
  }

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {trigger || (
          <Button className="rounded-xl gap-2 shadow-sm font-medium bg-accent text-white hover:bg-accent/90">
            <Plus className="w-4 h-4" />
            Novo Bloco de Estudo
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-1">Criar Bloco de Estudo</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Defina um bloco menor a partir de um material extraído.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Bloco</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                    placeholder="Ex: Introdução ao tema..."
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Material Origem</label>
                  <select
                    value={materialId}
                    onChange={e => setMaterialId(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.fileName} ({m.totalPages || '?'} págs)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Página Inicial</label>
                    <input 
                      type="number" 
                      min={1}
                      value={pageStart}
                      onChange={e => setPageStart(parseInt(e.target.value) || "")}
                      required
                      placeholder="Ex: 1"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Página Final</label>
                    <input 
                      type="number" 
                      min={1}
                      value={pageEnd}
                      onChange={e => setPageEnd(parseInt(e.target.value) || "")}
                      required
                      placeholder="Ex: 5"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading || !title.trim() || pageStart === "" || pageEnd === ""}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Criar Bloco
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
