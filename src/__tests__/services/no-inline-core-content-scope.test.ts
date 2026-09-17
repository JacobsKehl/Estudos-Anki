/**
 * src/__tests__/services/no-inline-core-content-scope.test.ts
 *
 * T18.1: o conteúdo principal é definido por UMA lista branca —
 * CFC_FILE_NAMES em src/lib/scheduler/config.ts. getGlobalMetrics e o
 * painel de viabilidade em schedule/page.tsx tinham cada um seu próprio
 * filtro largo (`studyPriority in [PRIMARY,ACTIVE]` + `materialRole !=
 * SUPPORT_MATERIAL`), que deixava 436 blocos não-CFC entrarem na conta —
 * a mesma família de defeito das três consultas de flashcard divergentes
 * (T13.3).
 *
 * Este teste varre src/app/** e src/components/** e reprova qualquer
 * arquivo que combine, a poucas linhas de distância, um filtro de
 * `studyPriority` restrito a PRIMARY/ACTIVE (ou equivalente por notIn
 * SECONDARY/EXCLUDED) COM um filtro de `materialRole != SUPPORT_MATERIAL`
 * — essa combinação é a assinatura de "estou tentando definir o que é
 * conteúdo principal" fora da fonte única.
 *
 * Não pega usos de `materialRole` ou `studyPriority` isolados para outros
 * fins legítimos (ex.: repair-supports filtra materialRole sem nenhuma
 * relação com studyPriority; continue-suggestions filtra por
 * subjectId específico, não por PRIMARY/ACTIVE em geral).
 */
import fs from "fs";
import path from "path";

const SCAN_ROOTS = ["src/app", "src/components"];
const FILE_EXTENSIONS = [".ts", ".tsx"];

// Achados do T18.1, reportados e NÃO corrigidos nesta rodada (decisão de
// escopo pendente, não permissão permanente — remover da lista ao consertar):
//   - page.tsx: query de "Estudo de Hoje" na home, decide o que aparece no
//     widget do dia, não computa percentual/viabilidade de conteúdo principal.
//   - continue-suggestions/route.ts: sugere o que estudar após concluir uma
//     matéria; pode sugerir material não-CFC hoje.
const KNOWN_UNFIXED_FILES = [
  path.join("src", "app", "page.tsx"),
  path.join("src", "app", "api", "schedule", "continue-suggestions", "route.ts"),
];

// Cobre tanto o filtro no `where` do Prisma (`studyPriority: { in: [...] }`)
// quanto o filtro em memória (`s.studyPriority === "PRIMARY"`), que é como
// schedule/page.tsx monta a lista de "matérias ativas".
const STUDY_PRIORITY_SCOPE_PATTERN = /studyPriority\s*(:\s*\{\s*(in|notIn)\s*:\s*\[[^\]]*(PRIMARY|ACTIVE|SECONDARY|EXCLUDED)|===\s*["'](PRIMARY|ACTIVE))/;
const MATERIAL_ROLE_SUPPORT_PATTERN = /materialRole\s*:\s*\{\s*not\s*:\s*["']SUPPORT_MATERIAL["']/;

function listFilesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(listFilesRecursive(fullPath));
    } else if (FILE_EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("Nenhuma tela monta o próprio filtro de escopo de conteúdo principal", () => {
  it("studyPriority(PRIMARY/ACTIVE) + materialRole(!=SUPPORT_MATERIAL) não aparecem próximos fora da fonte única", () => {
    const violations: string[] = [];

    for (const root of SCAN_ROOTS) {
      const absRoot = path.join(process.cwd(), root);
      if (!fs.existsSync(absRoot)) continue;

      for (const filePath of listFilesRecursive(absRoot)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const source = stripComments(raw);
        const lines = source.split("\n");

        const priorityLines: number[] = [];
        const materialRoleLines: number[] = [];
        lines.forEach((line, idx) => {
          if (STUDY_PRIORITY_SCOPE_PATTERN.test(line)) priorityLines.push(idx);
          if (MATERIAL_ROLE_SUPPORT_PATTERN.test(line)) materialRoleLines.push(idx);
        });

        // Não exige proximidade de linha: a assinatura é o ARQUIVO montar as
        // duas pontas do filtro largo (studyPriority PRIMARY/ACTIVE e
        // materialRole != SUPPORT_MATERIAL), mesmo que uma alimente uma
        // variável usada várias linhas depois (schedule/page.tsx é assim).
        const relPath = path.relative(process.cwd(), filePath);
        if (
          priorityLines.length > 0 &&
          materialRoleLines.length > 0 &&
          !KNOWN_UNFIXED_FILES.includes(relPath)
        ) {
          violations.push(`${relPath}:${priorityLines[0] + 1} (studyPriority) + :${materialRoleLines[0] + 1} (materialRole)`);
        }
      }
    }

    if (violations.length > 0) {
      console.error("\n=== FILTRO DE ESCOPO DE CONTEÚDO PRINCIPAL MONTADO FORA DA FONTE ÚNICA ===");
      violations.forEach((v) => console.error(`  ❌ ${v}`));
      console.error(
        "\nUse CFC_FILE_NAMES (src/lib/scheduler/config.ts) — material.originalFileName in CFC_FILE_NAMES\n"
      );
    }

    expect(violations).toEqual([]);
  });
});
