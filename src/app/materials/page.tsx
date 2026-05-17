import { Sparkles, Cloud, LayoutGrid, Library, Plus, Info, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { OrganizeAllButton } from "@/components/materials/OrganizeAllButton";
import { CloudUploadButton } from "@/components/materials/CloudUploadButton";
import { getMockUserId } from "@/lib/auth-mock";
import { MaterialsListClient } from "@/components/materials/MaterialsListClient";

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
  const mockUserId = await getMockUserId();

  try {
    const dbMaterials = await prisma.studyMaterial.findMany({
      where: { userId: mockUserId },
      include: {
        subject: true,
        _count: {
          select: { studyBlocks: true, flashcards: true }
        }
      },
      orderBy: { createdAt: 'desc' }
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

  } catch (error) {
    console.error("Failed to fetch materials:", error);
    materials = [];
  }

  const unorganizedCount = materials.filter(m => m.organizationStatus !== "ORGANIZED").length;

  return (
    <div className="space-y-10 max-w-6xl animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader 
          icon={Library}
          title="Biblioteca de Materiais"
          description="Sua central de estudos em nuvem protegida e organizada."
        />
        
        {/* Quick Action Button for Mobile or Header */}
        <div className="hidden md:block">
           <CloudUploadButton />
        </div>
      </div>

      {/* Cloud-First Welcome Hero */}
      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* Main Action Card */}
        <div className="lg:col-span-8 bg-card rounded-[2.5rem] p-8 md:p-10 border border-border/50 relative overflow-hidden flex flex-col justify-between shadow-sm">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-accent/10 text-accent hover:bg-accent/10 border-accent/20 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                Intelligent Analysis
              </Badge>
              <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3 text-green-500" />
                Cloud Protected
              </div>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Organizar Biblioteca</h2>
            <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
              Deixe a IA processar todos os seus documentos de uma vez. Ela identificará as matérias e criará blocos de estudo automaticamente.
            </p>
          </div>
          
          <div className="relative z-10 flex flex-wrap items-center gap-4 mt-10">
            <OrganizeAllButton unorganizedCount={unorganizedCount} />
            {materials.length > 0 && (
              <div className="opacity-50 hover:opacity-100 transition-opacity">
                <OrganizeAllButton unorganizedCount={0} force={true} />
              </div>
            )}
          </div>
          
          <Sparkles className="absolute -right-12 -bottom-12 w-80 h-80 text-accent/5 -rotate-12 pointer-events-none" />
        </div>

        {/* Upload & Info Cards Container */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Upload Card */}
          <div className="bg-accent rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-lg shadow-accent/20 text-white group cursor-default transition-all hover:scale-[1.02]">
            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
              <Plus className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">Novo Arquivo</h3>
              <p className="text-xs text-white/70">Arraste ou clique para subir PDF</p>
            </div>
            <CloudUploadButton />
          </div>

          {/* Stats/Status Card */}
          <div className="bg-muted/30 rounded-[2.5rem] p-6 border border-border/50 flex flex-col justify-center space-y-4">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-2xl bg-background flex items-center justify-center border border-border/50">
                 <LayoutGrid className="w-5 h-5 text-accent" />
               </div>
               <div>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total na Nuvem</p>
                 <p className="text-lg font-bold">{materials.length} Materiais</p>
               </div>
             </div>
             <p className="text-xs text-muted-foreground leading-relaxed">
               Sincronizado e disponível em todos os seus dispositivos.
             </p>
          </div>
        </div>
      </div>

      {/* Library View */}
      <div className="space-y-6 pt-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold tracking-tight">Meus Documentos</h3>
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          </div>
        </div>
        
        {materials.length === 0 ? (
          <EmptyState 
            icon={Cloud}
            title="Ainda não há arquivos na sua nuvem"
            description="Suba seu primeiro material de estudo clicando no botão acima."
          />
        ) : (
          <MaterialsListClient initialMaterials={materials} />
        )}
      </div>
    </div>
  );
}
