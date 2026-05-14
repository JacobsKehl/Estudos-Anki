import { MaterialFilters } from "@/components/materials/MaterialFilters";
import { MaterialCard } from "@/components/materials/MaterialCard";
import { MOCK_MATERIALS } from "@/lib/mocks";
import { BookOpen, Sparkles, Import, FolderSearch, RefreshCcw, Loader2, Blocks, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { OrganizeAllButton } from "@/components/materials/OrganizeAllButton";
import { InboxPanel } from "@/components/materials/InboxPanel";

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

import { getMockUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  let materials: MaterialItem[] = [];
  let subjects: { id: string, name: string }[] = [];
  const mockUserId = await getMockUserId();

  try {
    // 1. Fetch Materials from DB (only LOCAL_INBOX)
    const dbMaterials = await prisma.studyMaterial.findMany({
      where: { 
        userId: mockUserId,
        sourceType: "LOCAL_INBOX"
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
    console.error("Database connection failed, using mocks.", error);
    // Map mocks to match the new item type if needed, or use them as is if they are close
    materials = (MOCK_MATERIALS as any[]).map(m => ({
      ...m,
      blocksCount: m.hasExistingBlocks ? 3 : 0
    }));
  }

  const unorganizedCount = materials.filter(m => m.organizationStatus !== "ORGANIZED").length;

  return (
    <div className="space-y-10 max-w-6xl animate-in fade-in duration-700 pb-20">
      <PageHeader 
        icon={BookOpen}
        title="Biblioteca de PDFs"
        description="Gerencie e organize os materiais importados da sua pasta local."
      />

      <div className="mb-10">
        <InboxPanel />
      </div>

      {/* Hero: Bulk Organization Action */}
      <section className="bg-accent/5 rounded-[2.5rem] p-8 md:p-12 border border-accent/10 relative overflow-hidden mb-8">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 text-center md:text-left">
            <Badge className="bg-accent/10 text-accent hover:bg-accent/10 border-accent/20 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              Organizador Inteligente
            </Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Organizar meus estudos</h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Use a IA para identificar as matérias, fatiar seus PDFs em blocos de leitura e atualizar seu cronograma automaticamente.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <OrganizeAllButton unorganizedCount={unorganizedCount} />
            {materials.length > 0 && (
              <div className="opacity-70 hover:opacity-100 transition-opacity">
                <OrganizeAllButton unorganizedCount={0} force={true} />
              </div>
            )}
          </div>
        </div>
        <Sparkles className="absolute -right-8 -bottom-8 w-64 h-64 text-accent/5 -rotate-12 pointer-events-none" />
      </section>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-bold">PDFs na Biblioteca</h3>
          </div>
          {materials.length > 0 && <MaterialFilters />}
        </div>
        
        <div className="grid gap-6">
          {materials.length === 0 ? (
            <EmptyState 
              icon={Import}
              title="Sua biblioteca está vazia"
              description="Importe seus materiais a partir da pasta de entrada local acima."
            />
          ) : (
            materials.map((material) => (
              <MaterialCard key={material.id} material={material} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components can be moved to separate files later
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Layers } from "lucide-react";
