/**
 * src/__tests__/reviews/no-inline-next-review-at-query.test.ts
 *
 * T13.3: em três rodadas achamos três consultas independentes a Flashcard
 * usando nextReviewAt, uma por vez — cada descoberta invalidando a
 * conclusão anterior (getDueFlashcards, getUnifiedTodayCards,
 * reviews/page.tsx inline, profile/page.tsx inline). Um conserto que não
 * impeça a quarta não resolveu nada.
 *
 * Este teste varre src/app/** e src/components/** procurando qualquer
 * consulta que use nextReviewAt como FILTRO (`nextReviewAt: { lte: ... }`,
 * `{ gte: ... }` etc — sempre um objeto de operador Prisma). Isso distingue
 * de uma ESCRITA (`nextReviewAt: new Date()` ou `updateData.nextReviewAt =
 * now`, nunca um objeto), que é o fluxo normal de aprovação/resposta de
 * cartão e não precisa passar pela lista branca.
 *
 * A única fonte permitida de "vencido" fica em src/lib/srs/ (a fila de
 * hoje, com teto) e src/lib/reviews/ (a dívida, sem NEW) — e esses
 * diretórios nem entram no escopo da varredura, porque o ponto é garantir
 * que NENHUMA página ou componente monte essa lógica por conta própria.
 */
import fs from "fs";
import path from "path";

const SCAN_ROOTS = ["src/app", "src/components"];
const FILE_EXTENSIONS = [".ts", ".tsx"];

// Uso de FILTRO: sempre um objeto de operador Prisma ({ lte, gte, ... }).
// Uso de ESCRITA (`nextReviewAt: new Date()`, `x.nextReviewAt = now`) não bate aqui.
const QUERY_FILTER_PATTERN = /nextReviewAt\s*:\s*\{/;

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

describe("Nenhuma página/componente monta a própria consulta de 'vencido'", () => {
  it("nenhum arquivo em src/app/** ou src/components/** usa nextReviewAt como filtro de query", () => {
    const violations: string[] = [];

    for (const root of SCAN_ROOTS) {
      const absRoot = path.join(process.cwd(), root);
      if (!fs.existsSync(absRoot)) continue;

      for (const filePath of listFilesRecursive(absRoot)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const source = stripComments(raw);

        if (QUERY_FILTER_PATTERN.test(source)) {
          const relPath = path.relative(process.cwd(), filePath);
          const lineIndex = source.split("\n").findIndex((line) => QUERY_FILTER_PATTERN.test(line));
          const lineNumber = lineIndex >= 0 ? lineIndex + 1 : "?";
          violations.push(`${relPath}:${lineNumber}`);
        }
      }
    }

    if (violations.length > 0) {
      console.error("\n=== CONSULTAS INLINE A nextReviewAt FORA DA FONTE ÚNICA ===");
      violations.forEach((v) => console.error(`  ❌ ${v}`));
      console.error(
        "\nUse getTodayReviewQueue (src/lib/srs/today-review-queue.ts) ou " +
        "getReviewBacklogSize/getNewCardsWaitingCount (src/lib/reviews/) em vez de montar o where aqui.\n"
      );
    }

    expect(violations).toEqual([]);
  });
});
