import { Blocks, Pickaxe } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function BlocksPage() {
  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700 slide-in-from-bottom-4">
      <PageHeader 
        icon={Blocks}
        title="Blocos de Estudo"
        description="Gerenciamento global de todos os seus blocos de estudo."
      />

      <EmptyState 
        icon={Pickaxe}
        title="Página em Construção"
        description="Esta tela centralizará todos os blocos de estudo. Por enquanto, acesse e crie blocos diretamente pelas Matérias."
        action={{
          label: "Ver Minhas Matérias",
          href: "/subjects"
        }}
      />
    </div>
  );
}
