import { MaterialFilters } from "@/components/materials/MaterialFilters";
import { MaterialCard } from "@/components/materials/MaterialCard";
import { BookOpen, Sparkles, Cloud, LayoutGrid, Info, ArrowRight, Library } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { OrganizeAllButton } from "@/components/materials/OrganizeAllButton";
import { CloudUploadButton } from "@/components/materials/CloudUploadButton";
import { getMockUserId } from "@/lib/auth-mock";

type MaterialItem = {
  id: string;
  title: string;
  subjectName: string;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "ERROR";
  organizationStatus: string;
  processingError: string | null;
  pageCount: number;
  extractedWords: number;
  uploadedAt: string;
  hasExistingBlocks: boolean;
  blocksCount: number;
  flashcardsCount: number;
};

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  let materials: MaterialItem[] = [];
  let subjects: { id: string, name: string }[] = [];
  const mockUserId = await getMockUserId();

  try {
    // Fetch only Cloud materials (or legacy local ones that were already in DB)
    const dbMaterials = await prisma.studyMaterial.findMany({
      where: { 
        userId: mockUserId
      },
      include: {
        subject: true,
        _count: {
          select: { 
            studyBlocks: true,
            flashcards: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    materials = dbMaterials.map(m => ({
      id: m.id,
      title: m.fileName,
      subjectName: m.subject?.name || "Sem Matéria",
      status: m.processingStatus as any,
      organizationStatus: m.organizationStatus,
      processingError: m.processingError,
      pageCount: m.totalPages || 0,
      extractedWords: 0,
      uploadedAt: m.createdAt.toISOString(),
      hasExistingBlocks: m._count.studyBlocks > 0,
      blocksCount: m._count.studyBlocks,
      flashcardsCount: m._count.flashcards
    }));

    // Fetch subjects for filters
    subjects = await prisma.studySubject.findMany({
      where: { userId: mockUserId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });

  } catch (error) {
    console.error("Failed to fetch materials:", error);
    materials = [];
  }

  const unorganizedCount = materials.filter(m => m.organizationStatus !== "ORGANIZED").length;

  return (
    <div className="space-y-10 max-w-6xl animate-in fade-in duration-700 pb-20">
      <PageHeader 
        icon={Library}
        title="Biblioteca de Materiais"
        description="Gerencie seus documentos de estudo armazenados na nuvem."
      />

      {/* Hero: Upload & Action Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upload Card */}
        <div className="lg:col-span-1 bg-accent/5 rounded-[2.5rem] border border-accent/20 p-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="bg-accent/10 p-4 rounded-full">
            <Cloud className="w-8 h-8 text-accent" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Novo Material</h3>
            <p className="text-sm text-muted-foreground">
              Suba seus PDFs para começar a organizar seus estudos.
            </p>
          </div>
          <CloudUploadButton />
        </div>

        {/* Organize Hero Card */}
        <div className="lg:col-span-2 bg-card rounded-[2.5rem] p-8 border border-border/50 relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 space-y-4">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              Intelligent Organizer
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight">Processar Tudo</h2>
            <p className="text-muted-foreground text-lg max-w-md">
              A IA vai fatiar seus PDFs em blocos de estudo e gerar flashcards automaticamente.
            </p>
          </div>
          
          <div className="relative z-10 flex flex-wrap items-center gap-4 mt-8">
            <OrganizeAllButton unorganizedCount={unorganizedCount} />
            {materials.length > 0 && (
              <div className="opacity-60 hover:opacity-100 transition-opacity">
                <OrganizeAllButton unorganizedCount={0} force={true} />
              </div>
            )}
          </div>
          
          <Sparkles className="absolute -right-8 -bottom-8 w-64 h-64 text-accent/5 -rotate-12 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-accent/10 p-2 rounded-xl">
              <LayoutGrid className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Meus Documentos</h3>
              <p className="text-xs text-muted-foreground">{materials.length} materiais na biblioteca</p>
            </div>
          </div>
          {materials.length > 0 && <MaterialFilters />}
        </div>
        
        <div className="grid gap-4">
          {materials.length === 0 ? (
            <EmptyState 
              icon={Cloud}
              title="Sua biblioteca está vazia"
              description="Faça o upload do seu primeiro PDF usando o botão acima para começar."
            />
          ) : (
            materials.map((material) => (
              <MaterialCard key={material.id} material={material} />
            ))
          )}
        </div>
      </div>

      {/* Cloud Advantage Tip */}
      <div className="bg-muted/30 rounded-3xl p-6 flex items-start gap-4 border border-border/50">
        <div className="bg-blue-500/10 p-2 rounded-lg">
          <Info className="w-5 h-5 text-blue-500" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-sm">Dica da Nuvem</h4>
          <p className="text-sm text-muted-foreground">
            Seus arquivos agora estão no Supabase Storage. Você pode acessá-los, processá-los e revisá-los de qualquer dispositivo com internet.
          </p>
        </div>
      </div>
    </div>
  );
}

import { LayoutGrid as Layers } from "lucide-react";
