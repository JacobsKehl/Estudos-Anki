import { Settings, Pickaxe } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700 slide-in-from-bottom-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-light text-accent shadow-sm">
            <Settings className="h-5 w-5" />
          </div>
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Gerencie sua conta e preferências de estudo.
        </p>
      </div>

      <div className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-3xl bg-muted/10">
        <Pickaxe className="w-16 h-16 mb-6 text-accent opacity-20" />
        <h2 className="text-xl font-semibold mb-2">Página em Construção</h2>
        <p className="text-muted-foreground max-w-md">
          As opções de preferência e conta serão implementadas antes do lançamento oficial.
        </p>
      </div>
    </div>
  );
}
