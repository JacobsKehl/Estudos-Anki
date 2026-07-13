import { getMockUserId } from "@/lib/auth-mock";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HybridBlockWizard } from "@/components/hybrid-8020/HybridBlockWizard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewHybridBlockPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = await params;

  // 1. Validar FEATURE_FLAG
  if (process.env.ENABLE_HYBRID_8020 !== "true") {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-6 bg-card rounded-3xl border border-border/80 shadow-2xl mt-10">
        <h1 className="text-2xl font-bold text-foreground">Metodologia Híbrida 80/20</h1>
        <p className="text-muted-foreground leading-relaxed">
          Esta funcionalidade está temporariamente indisponível. Ative a flag correspondente no servidor para começar.
        </p>
        <Button asChild className="rounded-xl">
          <Link href={`/subjects/${id}`}>Voltar para Disciplina</Link>
        </Button>
      </div>
    );
  }

  // 2. Validar autenticação
  const userId = await getMockUserId();

  // 3. Validar subject (ownership)
  const subject = await prisma.studySubject.findFirst({
    where: { id, userId },
  });

  if (!subject) {
    return notFound();
  }

  // 4. Buscar materiais do usuário classificados como CFC ou ESTRATEGIA
  // Não carregamos PDF nem iniciamos timers
  const materials = await prisma.studyMaterial.findMany({
    where: {
      userId,
      subjectId: id,
      provider: { in: ["CFC", "ESTRATEGIA"] },
      processingStatus: "PROCESSED", // apenas materiais processados podem ser usados
    },
    select: {
      id: true,
      fileName: true,
      provider: true,
      totalPages: true,
    },
  });

  const cfcMaterials = materials.filter((m) => m.provider === "CFC");
  const estrategiaMaterials = materials.filter((m) => m.provider === "ESTRATEGIA");

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="rounded-xl -ml-3 text-muted-foreground hover:text-foreground" asChild>
          <Link href={`/subjects/${id}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para {subject.name}
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Novo Bloco Híbrido 80/20</h1>
        <p className="text-muted-foreground">
          Combine o material de ancoragem (CFC) com o aprofundamento (Estratégia) para um estudo de alto rendimento.
        </p>
      </div>

      <HybridBlockWizard
        subjectId={subject.id}
        cfcMaterials={cfcMaterials}
        estrategiaMaterials={estrategiaMaterials}
      />
    </div>
  );
}
