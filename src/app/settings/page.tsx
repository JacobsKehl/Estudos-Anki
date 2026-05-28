import { Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const mockUserId = await getMockUserId();
  let unorganizedCount = 0;
  let isAdmin = false;

  try {
    const user = await prisma.user.findUnique({
      where: { id: mockUserId },
      select: { email: true }
    });
    const userEmail = user?.email || "";
    isAdmin = userEmail === process.env.ADMIN_EMAIL ||
              (process.env.NODE_ENV === "development" && process.env.SHOW_ADMIN_TOOLS_IN_DEV === "true");

    const materials = await prisma.studyMaterial.findMany({
      where: { userId: mockUserId },
      select: { organizationStatus: true }
    });
    unorganizedCount = materials.filter(m => m.organizationStatus !== "ORGANIZED").length;
  } catch (error) {
    console.error("Failed to fetch materials for settings page:", error);
  }

  return (
    <div className="space-y-10 max-w-6xl animate-in fade-in duration-700 pb-20">
      <PageHeader 
        icon={Settings}
        title="Configurações"
        description="Personalize seu perfil, ajuste o algoritmo de repetição espaçada e gerencie notificações e ferramentas."
      />

      <SettingsForm unorganizedCount={unorganizedCount} isAdmin={isAdmin} />
    </div>
  );
}
