import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MaterialStatusBadge } from "@/components/materials/MaterialStatusBadge";
import { ProcessMaterialButton } from "@/components/materials/ProcessMaterialButton";
import { ArrowLeft, BookOpen, FileText, AlertCircle, Blocks } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlockGenerator } from "@/components/materials/BlockGenerator";
import { StudyBlockItem } from "@/components/subjects/StudyBlockItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";


export default async function MaterialDetailsPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let material: any = null;

  try {
    material = await prisma.studyMaterial.findUnique({
      where: { id },
      include: {
        subject: true,
        studyBlocks: true,
        extractedContent: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          orderBy: { pageNumber: "asc" } as any,
        },
      },
    });
  } catch (error) {
    console.error("DB Error", error);
  }

  if (!material) {
    return notFound();
  }

  const hasExistingBlocks = material.studyBlocks && material.studyBlocks.length > 0;

  const isPendingOrError = material.processingStatus === "PENDING" || material.processingStatus === "ERROR";

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-700 slide-in-from-bottom-4 pb-20">
      
      {/* Navigation & Header */}
      <div className="flex flex-col gap-6">
        <div>
          <Button variant="ghost" size="sm" className="rounded-xl -ml-3 text-muted-foreground hover:text-foreground">
            <Link href="/materials" className="flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Materiais
            </Link>
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 bg-card p-6 rounded-3xl border border-border/50 shadow-sm">
          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-2xl bg-sage-light/30 text-accent flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight leading-tight">{material.fileName}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-accent/40" />
                  {material.subject?.name || "Sem Matéria"}
                </span>
                <span>•</span>
                <span>{material.totalPages ? `${material.totalPages} páginas` : "Páginas desconhecidas"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 shrink-0">
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Blocks className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold">Blocos de Estudo</h2>
          </div>
          
          <div className="space-y-4">
            {material.studyBlocks.length === 0 ? (
              <div className="py-12 text-center bg-muted/10 rounded-3xl border-2 border-dashed border-border/60">
                <p className="text-muted-foreground">Nenhum bloco criado para este material.</p>

              </div>
            ) : (
              material.studyBlocks.map((block: any) => (
                <StudyBlockItem key={block.id} block={block} />
              ))
            )}
          </div>

          {/* Secondary: Raw Content */}
          <div className="pt-10">
            <div className="flex items-center gap-2 pb-2 border-b border-border mb-6">
              <BookOpen className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-bold text-muted-foreground">Conteúdo para Referência</h3>
            </div>
            
            {material.processingStatus === "PROCESSED" && material.extractedContent.length > 0 ? (
              <div className="space-y-12 opacity-60 hover:opacity-100 transition-opacity">
                {material.extractedContent.map((page: any) => (
                  <div key={page.id} className="relative group">
                    <div className="absolute -left-12 top-0 h-full flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-background py-1">
                        Pág
                      </div>
                      <div className="text-sm font-black text-accent">{page.pageNumber}</div>
                    </div>
                    
                    <div className="bg-card p-6 rounded-2xl border border-border/40 text-sm leading-relaxed whitespace-pre-wrap font-serif">
                      {page.text}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Conteúdo original indisponível para visualização direta.</p>
            )}
          </div>
        </div>

        {/* Right Sidebar: Material Info */}
        <div className="space-y-6">
          <Card className="rounded-[2rem] border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Informações</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data:</span>
                <span className="font-medium">{new Date(material.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Páginas:</span>
                <span className="font-medium">{material.totalPages}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="success" className="rounded-full">{material.organizationStatus}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
