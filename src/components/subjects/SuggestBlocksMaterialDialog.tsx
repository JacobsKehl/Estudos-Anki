"use client";

import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, Blocks, ArrowRight, Loader2, Info } from "lucide-react";
import { BlockGenerator } from "../materials/BlockGenerator";
import Link from "next/link";

interface Material {
  id: string;
  fileName: string;
  totalPages: number;
  processingStatus: string;
  createdAt: string;
  _count?: {
    studyBlocks: number;
  };
}

interface SuggestBlocksMaterialDialogProps {
  materials: Material[];
  subjectId: string;
}

export function SuggestBlocksMaterialDialog({ materials, subjectId }: SuggestBlocksMaterialDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = React.useState<string | null>(null);

  const processedMaterials = materials.filter(m => m.processingStatus === "PROCESSED");

  const handleSelectMaterial = (id: string) => {
    setSelectedMaterialId(id);
  };

  const selectedMaterial = processedMaterials.find(m => m.id === selectedMaterialId);

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)} 
        variant="outline" 
        className="rounded-xl gap-2 font-medium border-accent/20 hover:bg-accent/5 text-accent"
      >
        <Sparkles className="w-4 h-4" />
        Sugerir blocos com IA
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setSelectedMaterialId(null);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 rounded-[2.5rem]">
          <div className="p-8 overflow-y-auto">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                  <Sparkles className="w-6 h-6" />
                </div>
                {selectedMaterialId ? "Sugestões de Estudo" : "Escolha um material para sugerir blocos"}
              </DialogTitle>
            </DialogHeader>

            {!selectedMaterialId ? (
              <div className="space-y-6">
                {processedMaterials.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-border rounded-[2rem] bg-muted/5">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-bold text-lg">Nenhum material pronto para IA</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Antes de sugerir blocos, envie um PDF e extraia o texto do material.
                      </p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" className="rounded-xl" asChild>
                        <Link href="/materials">Ir para Materiais</Link>
                      </Button>
                      <Button className="rounded-xl bg-accent text-white" asChild>
                        <Link href="/materials">Enviar material</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {processedMaterials.map((material) => (
                      <div 
                        key={material.id} 
                        className="group relative bg-card hover:bg-accent/5 border border-border/50 hover:border-accent/30 p-5 rounded-[2rem] transition-all cursor-pointer flex items-center justify-between gap-4"
                        onClick={() => handleSelectMaterial(material.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-sage-light/30 text-accent flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-foreground group-hover:text-accent transition-colors leading-tight">
                              {material.fileName}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span>{material.totalPages} páginas</span>
                              <span>•</span>
                              <span className="text-accent/70 font-medium">Texto extraído</span>
                              {material._count && material._count.studyBlocks > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Blocks className="w-3 h-3" />
                                    {material._count.studyBlocks} blocos criados
                                  </span>
                                </>
                              )}
                            </div>
                            {material._count && material._count.studyBlocks > 0 && (
                              <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1 font-medium">
                                <Info className="w-3 h-3" />
                                Este material já possui {material._count.studyBlocks} blocos. Gerar novos pode criar duplicidades.
                              </p>
                            )}
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="rounded-full bg-muted/50 group-hover:bg-accent group-hover:text-white transition-all shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <BlockGenerator 
                  materialId={selectedMaterialId} 
                  hasExistingBlocks={(selectedMaterial?._count?.studyBlocks || 0) > 0}
                  mode="inline"
                />
                <div className="mt-8 pt-6 border-t border-border flex justify-start">
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setSelectedMaterialId(null)}>
                    Escolher outro material
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
