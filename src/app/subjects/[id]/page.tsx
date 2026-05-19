/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Blocks, Layers, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MaterialCard } from "@/components/materials/MaterialCard";
import { GenerateAllFlashcardsButton } from "@/components/subjects/GenerateAllFlashcardsButton";
import { StudyBlockItem } from "@/components/subjects/StudyBlockItem";
import { SupportBlockItem } from "@/components/subjects/SupportBlockItem";

import { getSubjectMetrics } from "@/lib/services/subject-metrics";
import { SubjectPerformancePanel } from "@/components/subjects/SubjectPerformancePanel";

export const dynamic = "force-dynamic";

export default async function SubjectDetailsPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const userId = await getMockUserId();
  
  let subject: any = null;
  let metrics: any = null;

  try {
    subject = await prisma.studySubject.findUnique({
      where: { id },
      include: {
        materials: {
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: { studyBlocks: true }
            }
          }
        },
        studyBlocks: {
          orderBy: { orderIndex: "asc" },
          include: { 
            material: true,
            supportMaterials: {
              include: {
                material: true
              }
            },
            _count: {
              select: {
                flashcards: true
              }
            }
          }
        },
      } as any
    });

    if (subject) {
      metrics = await getSubjectMetrics(id, userId);
    }
  } catch (error) {
    console.error("DB Error", error);
  }

  if (!subject || !metrics) {
    return notFound();
  }

  // Extrair todos os blocos de apoio vinculados aos blocos teóricos da matéria
  const supportBlocks = subject.studyBlocks.flatMap((block: any) => 
    (block.supportMaterials || []).map((support: any) => ({
      ...support,
      studyBlock: block // referência de volta para o bloco teórico pai
    }))
  );

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700 slide-in-from-bottom-4 pb-20">
      
      {/* Navigation & Header */}
      <div className="flex flex-col gap-6">
        <div>
          <Button variant="ghost" size="sm" className="rounded-xl -ml-3 text-muted-foreground hover:text-foreground">
            <Link href="/subjects" className="flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Matérias
            </Link>
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 bg-card p-6 md:p-8 rounded-3xl border border-border/50 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
          <div className="flex gap-4 items-start">
            <div className="w-16 h-16 rounded-2xl bg-sage-light/30 text-accent flex items-center justify-center shrink-0">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight leading-tight">{subject.name}</h1>
              {subject.description && (
                <p className="text-muted-foreground">{subject.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Layers className="w-4 h-4" />
                  {subject.materials.length} Materiais
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Blocks className="w-4 h-4" />
                  {subject.studyBlocks.length} Blocos
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Panel */}
      <SubjectPerformancePanel metrics={metrics} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Blocks */}
        <div className="lg:col-span-2 space-y-8">
          {/* Blocos de Estudo */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Blocks className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-semibold">Blocos de Estudo</h2>
              </div>
              <div className="flex items-center gap-2">
                <GenerateAllFlashcardsButton subjectId={subject.id} />
              </div>
            </div>

            <div className="space-y-4">
              {subject.studyBlocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-card rounded-[2.5rem] border-2 border-dashed border-border/60 space-y-6">
                  <div className="w-20 h-20 rounded-3xl bg-sage-light/30 text-accent flex items-center justify-center">
                    <Blocks className="w-10 h-10" />
                  </div>
                  <div className="max-w-md space-y-2">
                    <h3 className="text-xl font-bold">Ainda não há blocos de estudo</h3>
                    <p className="text-muted-foreground">
                      Seus materiais importados ainda não foram organizados. Vá até a Biblioteca para fatiar seus conteúdos automaticamente.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button asChild className="rounded-xl gap-2 font-medium bg-accent text-white hover:bg-accent/90 h-12 px-8">
                      <Link href="/materials">
                        <Sparkles className="w-4 h-4" />
                        Organizar meus estudos
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                subject.studyBlocks.map((block: any) => (
                  <StudyBlockItem key={block.id} block={block} />
                ))
              )}
            </div>
          </div>

          {/* Blocos de Apoio */}
          {supportBlocks.length > 0 && (
            <div className="space-y-6 pt-4 border-t border-border/40">
              <div className="flex items-center gap-2 pb-2">
                <Layers className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-semibold">Blocos de Apoio</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {supportBlocks.map((support: any) => (
                  <SupportBlockItem key={support.id} support={support} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Materials */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Materiais</h2>
            </div>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-accent">
              <Link href="/materials">Gerenciar</Link>
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {subject.materials.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/5">
                Nenhum material associado a esta disciplina.
              </div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              subject.materials.map((material: any) => {
                const mappedMat = {
                  id: material.id,
                  title: material.fileName,
                  subjectName: subject.name,
                  status: material.processingStatus,
                  pageCount: material.totalPages || 0,
                  extractedWords: 0,
                  uploadedAt: material.createdAt.toISOString(),
                  hasExistingBlocks: subject.studyBlocks.some((b: any) => b.materialId === material.id),
                };
                return <MaterialCard key={material.id} material={mappedMat as any} />;
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
