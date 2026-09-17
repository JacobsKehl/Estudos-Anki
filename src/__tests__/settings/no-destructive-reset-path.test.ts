/**
 * src/__tests__/settings/no-destructive-reset-path.test.ts
 *
 * L5 (auditoria 17/09): SettingsForm.tsx tinha um <OrganizeAllButton force={true}>
 * dentro do acordeão "Ferramentas avançadas do sistema" — um clique dispara
 * POST /api/materials/organize-all {reset:true}, que apaga TODOS os flashcards
 * e todo o histórico de SRS do usuário (CFC incluído) e todo o StudySchedule
 * (que arrasta em cascata os StudyScheduleItem, anulando o filtro que os
 * protegia — schema.prisma:397, onDelete: Cascade). Os cartões não voltam: a
 * reorganização por IA só reprocessa material não-CFC.
 *
 * Este teste lê o CÓDIGO-FONTE de SettingsForm.tsx (o projeto não tem React
 * Testing Library, só jsdom — mesma técnica do guardião, que lê o CSV em vez
 * de renderizar), e afirma que esse arquivo nunca mais contém um caminho de
 * clique até essa rota destrutiva. Um segundo caso protege o lado bom: a
 * Biblioteca continua usando o mesmo componente sem force, então "consertar"
 * movendo o botão de volta para lá não passa left despercebido.
 */
import fs from "fs";
import path from "path";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
}

describe("Caminho de clique até organize-all {reset:true} — não deve existir em Settings", () => {
  it("SettingsForm.tsx NÃO contém <OrganizeAllButton> com force (nem force, nem force={true}, nem reset)", () => {
    const rawSource = readSource("src/components/settings/SettingsForm.tsx");
    // Remove comentários JSX/JS antes de checar código real — um comentário
    // explicando a remoção pode citar "reset:true" em prosa sem reintroduzir o caminho.
    const source = rawSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

    const hasOrganizeAllButtonTag = /<OrganizeAllButton\b/.test(source);
    const hasForceProp = /<OrganizeAllButton[^>]*\bforce\b/.test(source);
    const hasResetLiteral = /reset\s*:\s*true/.test(source);

    if (hasOrganizeAllButtonTag) {
      const match = source.match(/<OrganizeAllButton[^>]*>/);
      console.error(`\n❌ <OrganizeAllButton> ainda presente em SettingsForm.tsx: ${match?.[0]}\n`);
    }

    expect(hasOrganizeAllButtonTag).toBe(false);
    expect(hasForceProp).toBe(false);
    expect(hasResetLiteral).toBe(false);
  });

  it("materials/page.tsx continua usando <OrganizeAllButton> SEM force (o caminho não-destrutivo sobrevive)", () => {
    const source = readSource("src/app/materials/page.tsx");

    const hasOrganizeAllButtonTag = /<OrganizeAllButton\b/.test(source);
    const hasForceProp = /<OrganizeAllButton[^>]*\bforce\s*=\s*\{?\s*true/.test(source);

    expect(hasOrganizeAllButtonTag).toBe(true);
    expect(hasForceProp).toBe(false);
  });
});
