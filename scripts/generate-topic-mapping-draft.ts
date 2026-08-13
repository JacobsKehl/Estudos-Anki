import fs from "fs";
import path from "path";
import { OFFICIAL_TOPICS, OfficialTopic } from "../src/lib/constants/official-topics";

// ═══ MAPEAMENTOS DE-PARA CANÔNICOS DE MATÉRIA ═══
const V1_SUBJECT_CANONICAL_MAP: Record<string, string> = {
  "Língua Portuguesa": "PORTUGUESE",
  "Direito Constitucional": "DIREITO_CONSTITUCIONAL",
  "Direito Processual do Trabalho": "DIREITO_PROCESSUAL_TRABALHO",
  "Direito do Trabalho": "DIREITO_TRABALHO",
  "Direito Processual Civil": "DIREITO_PROCESSUAL_CIVIL",
  "Direito Administrativo": "DIREITO_ADMINISTRATIVO",
  "Direito Civil": "DIREITO_CIVIL",
};

interface ProjetadoTopic {
  id: string;
  subjectCanonicalKey: string;
  subjectName: string;
  topicCode: string;
  title: string;
  normalizedTitle: string;
  orderIndex: number;
  weight: number;
  blocoConhecimento: string;
  questoesDaMateria: number;
}

// Extrair V2 de generate-syllabus-migration-sql.ts
const sqlGeneratorPath = path.join(__dirname, "generate-syllabus-migration-sql.ts");
const sqlGeneratorCode = fs.readFileSync(sqlGeneratorPath, "utf-8");
const matchV2 = sqlGeneratorCode.match(/TRT4_2026_PROJETADO_TOPICS: ProjetadoTopic\[\] = (\[[\s\S]*?\n\];)/);

if (!matchV2) {
  console.error("❌ Não foi possível ler TRT4_2026_PROJETADO_TOPICS de generate-syllabus-migration-sql.ts");
  process.exit(1);
}

const OFFICIAL_TOPICS_V2: ProjetadoTopic[] = eval(matchV2[1]);

// ═══ VERIFICAÇÃO DE SANIDADE DOS SEEDS ═══
console.log("🔍 Verificando contagem de tópicos dos seeds reais...");
console.log(`V1 Total (OFFICIAL_TOPICS): ${OFFICIAL_TOPICS.length} (esperado: 110)`);
console.log(`V2 Total (TRT4_2026_PROJETADO): ${OFFICIAL_TOPICS_V2.length} (esperado: 109)`);

if (OFFICIAL_TOPICS.length !== 110 || OFFICIAL_TOPICS_V2.length !== 109) {
  console.error("❌ FALHA DE SANIDADE: A contagem de tópicos diverge do esperado (110 na V1 e 109 na V2). Abortando.");
  process.exit(1);
}

// ═══ NORMALIZAÇÃO E CÁLCULO DE SIMILARIDADE ═══

const STOP_WORDS = new Set([
  "do", "da", "dos", "das", "de", "e", "o", "a", "os", "as", "em", "no", "na", "nos", "nas",
  "para", "com", "por", "sobre", "que", "lei", "nº", "noções", "conceito", "princípios", "gerais",
  "art", "artigo", "sua", "seus", "suas", "como", "ou"
]);

function tokenize(text: string): Set<string> {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");

  const tokens = normalized
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));

  return new Set(tokens);
}

function calculateSimilarity(v2Title: string, v1Title: string): number {
  const t2 = tokenize(v2Title);
  const t1 = tokenize(v1Title);

  if (t2.size === 0 || t1.size === 0) return 0;

  let intersection = 0;
  for (const token of t2) {
    if (t1.has(token)) intersection++;
  }

  // Jaccard similarity / Overlap ratio
  const union = new Set([...t2, ...t1]).size;
  const jaccard = intersection / union;
  const overlapV2 = intersection / t2.size;
  const overlapV1 = intersection / t1.size;

  // Score ponderado
  return Math.round((jaccard * 0.4 + overlapV2 * 0.3 + overlapV1 * 0.3) * 100) / 100;
}

function suggestRelation(score: number, v2Title: string, v1Title: string): string {
  if (score >= 0.85) return "EXATO";
  if (score >= 0.60) {
    const t2Size = tokenize(v2Title).size;
    const t1Size = tokenize(v1Title).size;
    if (t1Size > t2Size * 1.5) return "V1_MAIS_AMPLO";
    if (t2Size > t1Size * 1.5) return "V1_MAIS_ESTREITO";
    return "PARCIAL";
  }
  if (score >= 0.40) return "PARCIAL";
  return ""; // Vazio se sem convicção
}

// ═══ ALGORITMO DE CORRESPONDÊNCIA ═══

interface DraftRow {
  v2_topic_id: string;
  v2_materia: string;
  v2_topico: string;
  v1_topic_id: string;
  v1_materia: string;
  v1_topico: string;
  relacao_sugerida: string;
  score: number;
  revisado: string;
  observacao: string;
}

const draftRows: DraftRow[] = [];
const v1ReferencedIds = new Set<string>();
const v2ReferencedIds = new Set<string>();

// 1. Agrupar V1 por materia canonical key
const v1ByCanonicalKey = new Map<string, OfficialTopic[]>();
for (const t1 of OFFICIAL_TOPICS) {
  const ck = V1_SUBJECT_CANONICAL_MAP[t1.subjectName] || "OUTROS";
  if (!v1ByCanonicalKey.has(ck)) v1ByCanonicalKey.set(ck, []);
  v1ByCanonicalKey.get(ck)!.push(t1);
}

// 2. Para cada tópico da V2, buscar até 3 melhores candidatos na V1 da mesma matéria
for (const t2 of OFFICIAL_TOPICS_V2) {
  v2ReferencedIds.add(t2.id);
  const candidatesV1 = v1ByCanonicalKey.get(t2.subjectCanonicalKey) || [];

  if (candidatesV1.length === 0) {
    // Matéria não existe na V1 (ex: RLM, Legislação)
    draftRows.push({
      v2_topic_id: t2.id,
      v2_materia: t2.subjectName,
      v2_topico: `${t2.topicCode} - ${t2.title}`,
      v1_topic_id: "",
      v1_materia: "",
      v1_topico: "",
      relacao_sugerida: "NENHUM",
      score: 0,
      revisado: "",
      observacao: "Matéria ausente na V1 (grade do cursinho)",
    });
    continue;
  }

  // Calcular score com todos os tópicos V1 da mesma matéria
  const scored = candidatesV1.map(t1 => ({
    t1,
    score: calculateSimilarity(t2.title, t1.title),
  })).sort((a, b) => b.score - a.score);

  // Pegar até 3 melhores candidatos com score > 0.15
  const topCandidates = scored.filter(c => c.score >= 0.15).slice(0, 3);

  if (topCandidates.length === 0) {
    // Nenhum candidato relevante na matéria
    draftRows.push({
      v2_topic_id: t2.id,
      v2_materia: t2.subjectName,
      v2_topico: `${t2.topicCode} - ${t2.title}`,
      v1_topic_id: "",
      v1_materia: "",
      v1_topico: "",
      relacao_sugerida: "NENHUM",
      score: 0,
      revisado: "",
      observacao: "Sem correspondência relevante na matéria",
    });
  } else {
    for (const { t1, score } of topCandidates) {
      v1ReferencedIds.add(t1.id);
      const rel = suggestRelation(score, t2.title, t1.title);
      draftRows.push({
        v2_topic_id: t2.id,
        v2_materia: t2.subjectName,
        v2_topico: `${t2.topicCode} - ${t2.title}`,
        v1_topic_id: t1.id,
        v1_materia: t1.subjectName,
        v1_topico: `${t1.topicCode} - ${t1.title}`,
        relacao_sugerida: rel,
        score,
        revisado: "",
        observacao: "",
      });
    }
  }
}

// 3. Garantir cobertura total da V1 (qualquer tópico V1 que não apareceu ganha uma linha explícita)
const unreferencedV1 = OFFICIAL_TOPICS.filter(t1 => !v1ReferencedIds.has(t1.id));
for (const t1 of unreferencedV1) {
  // Procura se há algum tópico da V2 na mesma matéria para servir de par candidato
  const ck = V1_SUBJECT_CANONICAL_MAP[t1.subjectName];
  const matchingV2 = OFFICIAL_TOPICS_V2.filter(t2 => t2.subjectCanonicalKey === ck);
  
  if (matchingV2.length > 0) {
    // Acha a melhor correspondência mesmo com score baixo
    const bestMatch = matchingV2
      .map(t2 => ({ t2, score: calculateSimilarity(t2.title, t1.title) }))
      .sort((a, b) => b.score - a.score)[0];

    v1ReferencedIds.add(t1.id);
    draftRows.push({
      v2_topic_id: bestMatch.t2.id,
      v2_materia: bestMatch.t2.subjectName,
      v2_topico: `${bestMatch.t2.topicCode} - ${bestMatch.t2.title}`,
      v1_topic_id: t1.id,
      v1_materia: t1.subjectName,
      v1_topico: `${t1.topicCode} - ${t1.title}`,
      relacao_sugerida: suggestRelation(bestMatch.score, bestMatch.t2.title, t1.title),
      score: bestMatch.score,
      revisado: "",
      observacao: "Adicionado para garantir cobertura de V1",
    });
  } else {
    // Matéria V1 sem V2 equivalente (ex: Direito Civil)
    v1ReferencedIds.add(t1.id);
    draftRows.push({
      v2_topic_id: "",
      v2_materia: "",
      v2_topico: "",
      v1_topic_id: t1.id,
      v1_materia: t1.subjectName,
      v1_topico: `${t1.topicCode} - ${t1.title}`,
      relacao_sugerida: "NENHUM",
      score: 0,
      revisado: "",
      observacao: "Matéria V1 arquivada / fora do edital V2 (Direito Civil)",
    });
  }
}

// ═══ VALIDAÇÃO DE COBERTURA ═══
const missingV2 = OFFICIAL_TOPICS_V2.filter(t2 => !v2ReferencedIds.has(t2.id));
const missingV1 = OFFICIAL_TOPICS.filter(t1 => !v1ReferencedIds.has(t1.id));

if (missingV2.length > 0 || missingV1.length > 0) {
  console.error(`❌ FALHA DE COBERTURA!`);
  if (missingV2.length > 0) console.error(`V2 sem cobertura (${missingV2.length}):`, missingV2.map(t => t.id));
  if (missingV1.length > 0) console.error(`V1 sem cobertura (${missingV1.length}):`, missingV1.map(t => t.id));
  process.exit(1);
}

// ═══ ESCREVER ARQUIVO CSV ═══
const outDir = path.join(__dirname, "../docs/taxonomy");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const csvPath = path.join(outDir, "de-para-draft.csv");

function escapeCSV(field: string | number): string {
  const str = String(field ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const headers = [
  "v2_topic_id",
  "v2_materia",
  "v2_topico",
  "v1_topic_id",
  "v1_materia",
  "v1_topico",
  "relacao_sugerida",
  "score",
  "revisado",
  "observacao"
];

let csvContent = headers.join(",") + "\n";
for (const r of draftRows) {
  const line = [
    escapeCSV(r.v2_topic_id),
    escapeCSV(r.v2_materia),
    escapeCSV(r.v2_topico),
    escapeCSV(r.v1_topic_id),
    escapeCSV(r.v1_materia),
    escapeCSV(r.v1_topico),
    escapeCSV(r.relacao_sugerida),
    escapeCSV(r.score),
    escapeCSV(r.revisado),
    escapeCSV(r.observacao)
  ].join(",");
  csvContent += line + "\n";
}

fs.writeFileSync(csvPath, csvContent, "utf-8");

// ═══ METRICAS E RESUMO ═══
const highScores = draftRows.filter(r => r.score >= 0.85);
const emptyRel = draftRows.filter(r => r.relacao_sugerida === "");
const lowScoreV1 = OFFICIAL_TOPICS.filter(t1 => {
  const rows = draftRows.filter(r => r.v1_topic_id === t1.id);
  return rows.every(r => r.score < 0.40);
});

console.log("\n✅ Rascunho de De-Para gerado com sucesso em:");
console.log(` 📄 ${csvPath}`);
console.log("\n📊 MÉTICAS DO RASCUNHO:");
console.log(` - Total de linhas geradas no CSV: ${draftRows.length}`);
console.log(` - Tópicos V2 com candidato único de score ALTO (>= 0.85): ${highScores.length}`);
console.log(` - Linhas com relação sugerida VAZIA (sem convicção): ${emptyRel.length}`);
console.log(` - Tópicos V1 sem nenhuma linha de score relevante (score < 0.40): ${lowScoreV1.length}`);
console.log(` - Cobertura V1: 100% (${OFFICIAL_TOPICS.length}/${OFFICIAL_TOPICS.length} verificados)`);
console.log(` - Cobertura V2: 100% (${OFFICIAL_TOPICS_V2.length}/${OFFICIAL_TOPICS_V2.length} verificados)`);
