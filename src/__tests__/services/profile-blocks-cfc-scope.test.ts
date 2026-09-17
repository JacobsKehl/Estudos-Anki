/**
 * src/__tests__/services/profile-blocks-cfc-scope.test.ts
 *
 * T19 (achado ao validar o preview do T18): /profile contava
 * `prisma.studyBlock.count({ where: { userId } })` — SEM NENHUM filtro de
 * escopo, nem studyPriority/materialRole (que ao menos o guard test do
 * T18.1 pegaria), nem CFC_FILE_NAMES. Uma QUARTA variante do mesmo defeito,
 * mais simples ainda que as anteriores: nenhum filtro nenhum.
 *
 * profile/page.tsx é Server Component sem função exportada isoladamente
 * testável — teste de fonte, mesma técnica do guardião e do T13.3/T18.1:
 * lê o arquivo e afirma que a contagem de blocos usa CFC_FILE_NAMES.
 *
 * T19 (segundo achado, no mesmo preview): filtrar por CFC_FILE_NAMES
 * sozinho não basta. Há 100 StudyBlock EXCLUDED (duplicatas, o P2)
 * vinculados aos mesmos 5 materiais — totalBlocks sem excluir
 * theoryStatus="EXCLUDED" contava 189 em vez de 89, e a tela mostrou
 * "48 de 189" (25%) em produção. completedBlocks já era whitelist
 * (theoryStatus:"COMPLETED", nunca inclui EXCLUDED); totalBlocks não.
 */
import fs from "fs";
import path from "path";

describe("/profile — contagem de blocos escopada por CFC_FILE_NAMES", () => {
  it("totalBlocks e completedBlocks filtram por material.originalFileName in CFC_FILE_NAMES", () => {
    const filePath = path.join(process.cwd(), "src", "app", "profile", "page.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toMatch(/import\s*\{\s*CFC_FILE_NAMES\s*\}\s*from\s*["']@\/lib\/scheduler\/config["']/);

    // Isola o bloco das duas consultas (entre o comentário "Buscar estatísticas
    // dos blocos" e o próximo comentário numerado) para não deixar passar um
    // import não usado.
    const statsBlockMatch = source.match(/Buscar estatísticas dos blocos[\s\S]*?(?=\/\/ 3\.)/);
    expect(statsBlockMatch).not.toBeNull();
    const statsBlock = statsBlockMatch![0];

    const cfcFilterOccurrences = statsBlock.match(/originalFileName:\s*\{\s*in:\s*\[\.\.\.CFC_FILE_NAMES\]\s*\}/g) || [];
    expect(cfcFilterOccurrences.length).toBe(2); // totalBlocks e completedBlocks
  });

  it("totalBlocks exclui theoryStatus EXCLUDED — não conta as 100 duplicatas do P2", () => {
    const filePath = path.join(process.cwd(), "src", "app", "profile", "page.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    // Isola só a consulta de totalBlocks (da declaração da const até o
    // fechamento do count), pra não deixar passar o filtro whitelist que
    // completedBlocks já tem por outro motivo (theoryStatus:"COMPLETED").
    const totalBlocksMatch = source.match(/const totalBlocks = await prisma\.studyBlock\.count\(\{[\s\S]*?\}\);/);
    expect(totalBlocksMatch).not.toBeNull();
    const totalBlocksQuery = totalBlocksMatch![0];

    expect(totalBlocksQuery).toMatch(/theoryStatus:\s*\{\s*not:\s*["']EXCLUDED["']\s*\}/);
  });
});
