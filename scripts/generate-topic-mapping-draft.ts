import fs from "fs";
import path from "path";
import { OFFICIAL_TOPICS, OfficialTopic } from "../src/lib/constants/official-topics";
import { TRT4_2026_PROJETADO_TOPICS, ProjetadoTopic } from "../src/lib/constants/projected-topics-trt4";

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

// Ordem de prioridade para ergonomia de curadoria (Peso 2 primeiro, depois o resto)
const SUBJECT_PRIORITY: Record<string, number> = {
  "DIREITO_CONSTITUCIONAL": 1,
  "DIREITO_PROCESSUAL_TRABALHO": 2,
  "DIREITO_TRABALHO": 3,
  "DIREITO_PROCESSUAL_CIVIL": 4,
  "DIREITO_ADMINISTRATIVO": 5,
  "PORTUGUESE": 6,
  "DIREITO_CIVIL": 7,
  "RACIOCINIO_LOGICO_MATEMATICO": 8,
  "LEGISLACAO": 9,
};

// ═══ VERIFICAÇÃO DE SANIDADE DOS SEEDS REAIS ═══
console.log("🔍 Verificando contagem de tópicos dos módulos de seed reais...");
console.log(`V1 Total (OFFICIAL_TOPICS): ${OFFICIAL_TOPICS.length} (esperado: 110)`);
console.log(`V2 Total (TRT4_2026_PROJETADO): ${TRT4_2026_PROJETADO_TOPICS.length} (esperado: 109)`);

if (OFFICIAL_TOPICS.length !== 110 || TRT4_2026_PROJETADO_TOPICS.length !== 109) {
  console.error("❌ FALHA DE SANIDADE: A contagem de tópicos diverge do esperado. Abortando.");
  process.exit(1);
}

// ═══ TOKENIZAÇÃO E CÁLCULO DE CONTINÊNCIA (BLOCO 2) ═══

// Palavras vazias estritamente limitadas a preposições e artigos
const STOP_WORDS = new Set([
  "de", "do", "da", "dos", "das", "e", "o", "a", "os", "as", "em", "no", "na", "nos", "nas",
  "para", "com", "por", "sobre", "que"
]);

function tokenize(text: string): { tokens: Set<string>; numbersAndNorms: Set<string> } {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const rawWords = normalized
    .replace(/[^a-z0-9\s\/]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w));

  const tokens = new Set<string>();
  const numbersAndNorms = new Set<string>();

  for (const word of rawWords) {
    tokens.add(word);
    if (/\d/.test(word) || ["clt", "cpc", "tst", "stf", "idpj", "adi", "adc", "adpf", "pje", "lgpd", "lbi", "csjt", "cnj", "stj"].includes(word)) {
      numbersAndNorms.add(word);
    }
  }

  return { tokens, numbersAndNorms };
}

interface ContainmentResult {
  score: number;
  contV1: number;
  contV2: number;
  sobraStr: string;
  suggestedRelation: string;
}

function calculateContainment(v1Title: string, v2Title: string): ContainmentResult {
  const t1 = tokenize(v1Title);
  const t2 = tokenize(v2Title);

  if (t1.tokens.size === 0 || t2.tokens.size === 0) {
    return { score: 0, contV1: 0, contV2: 0, sobraStr: "N/A", suggestedRelation: "NENHUM" };
  }

  const intersection = new Set<string>();
  const v1Only = new Set<string>();
  const v2Only = new Set<string>();

  for (const token of t1.tokens) {
    if (t2.tokens.has(token)) {
      intersection.add(token);
    } else {
      v1Only.add(token);
    }
  }

  for (const token of t2.tokens) {
    if (!t1.tokens.has(token)) {
      v2Only.add(token);
    }
  }

  // Razões de continência
  const contV1 = Math.round((intersection.size / t1.tokens.size) * 100) / 100; // fração do V1 contida no V2
  const contV2 = Math.round((intersection.size / t2.tokens.size) * 100) / 100; // fração do V2 contida no V1

  // Score de similaridade geral com bônus para normas
  const unionSize = new Set([...t1.tokens, ...t2.tokens]).size;
  const jaccard = intersection.size / unionSize;
  let score = jaccard * 0.4 + contV1 * 0.3 + contV2 * 0.3;

  let normMatches = 0;
  for (const norm of t1.numbersAndNorms) {
    if (t2.numbersAndNorms.has(norm)) normMatches++;
  }
  if (normMatches > 0) {
    score = Math.min(1.0, score + 0.35 * normMatches);
  }
  score = Math.round(score * 100) / 100;

  // Sobras explícitas para a coluna
  const v1Sobra = Array.from(v1Only).slice(0, 4).join(" ");
  const v2Sobra = Array.from(v2Only).slice(0, 4).join(" ");
  const sobraParts: string[] = [];
  if (v1Sobra) sobraParts.push(`V1+: [${v1Sobra}]`);
  if (v2Sobra) sobraParts.push(`V2+: [${v2Sobra}]`);
  const sobraStr = sobraParts.join(" | ") || "sem sobra";

  // Sugestão derivada diretamente da continência (BLOCO 2)
  let suggestedRelation = "NENHUM";
  if (contV1 >= 0.85 && contV2 >= 0.85) {
    suggestedRelation = "EXATO";
  } else if (contV2 >= 0.65 && contV1 < 0.65) {
    suggestedRelation = "V1_MAIS_AMPLO"; // V2 cabe na V1, e V1 tem sobra
  } else if (contV1 >= 0.65 && contV2 < 0.65) {
    suggestedRelation = "V1_MAIS_ESTREITO"; // V1 cabe na V2, e V2 tem sobra
  } else if (contV1 >= 0.30 || contV2 >= 0.30 || score >= 0.35) {
    suggestedRelation = "PARCIAL";
  }

  return { score, contV1, contV2, sobraStr, suggestedRelation };
}

// ═══ ALGORITMO DE CORRESPONDÊNCIA E TRAVAS ESTRUTURAIS (BLOCO 3) ═══

interface DraftRow {
  v2_topic_id: string;
  v2_materia: string;
  v2_topico: string;
  v1_topic_id: string;
  v1_materia: string;
  v1_topico: string;
  relacao_sugerida: string;
  score: number;
  cont_v1: number;
  cont_v2: number;
  sobra: string;
  revisado: string;
  observacao: string;
  subjectCanonicalKey: string;
}

const draftRows: DraftRow[] = [];
const v1ReferencedIds = new Set<string>();
const v2ReferencedIds = new Set<string>();

// Agrupar V1 por matéria canonical key
const v1ByCanonicalKey = new Map<string, OfficialTopic[]>();
for (const t1 of OFFICIAL_TOPICS) {
  const ck = V1_SUBJECT_CANONICAL_MAP[t1.subjectName] || "OUTROS";
  if (!v1ByCanonicalKey.has(ck)) v1ByCanonicalKey.set(ck, []);
  v1ByCanonicalKey.get(ck)!.push(t1);
}

// 1. Processar tópicos V2 buscando candidatos V1
for (const t2 of TRT4_2026_PROJETADO_TOPICS) {
  v2ReferencedIds.add(t2.id);
  const candidatesV1 = v1ByCanonicalKey.get(t2.subjectCanonicalKey) || [];

  if (candidatesV1.length === 0) {
    // Matérias ausentes na V1 (RLM, Legislação)
    draftRows.push({
      v2_topic_id: t2.id,
      v2_materia: t2.subjectName,
      v2_topico: `${t2.topicCode} - ${t2.title}`,
      v1_topic_id: "",
      v1_materia: "",
      v1_topico: "",
      relacao_sugerida: "NENHUM",
      score: 0,
      cont_v1: 0,
      cont_v2: 0,
      sobra: "N/A",
      revisado: "",
      observacao: "Matéria ausente na V1 (grade do cursinho)",
      subjectCanonicalKey: t2.subjectCanonicalKey,
    });
    continue;
  }

  // Calcular continência com tópicos V1 da mesma matéria
  const scored = candidatesV1
    .map(t1 => {
      const res = calculateContainment(t1.title, t2.title);
      return { t1, res };
    })
    .sort((a, b) => b.res.score - a.res.score);

  // Selecionar candidatos com score >= 0.25 (até 3)
  const topCandidates = scored.filter(c => c.res.score >= 0.25).slice(0, 3);

  if (topCandidates.length === 0) {
    draftRows.push({
      v2_topic_id: t2.id,
      v2_materia: t2.subjectName,
      v2_topico: `${t2.topicCode} - ${t2.title}`,
      v1_topic_id: "",
      v1_materia: "",
      v1_topico: "",
      relacao_sugerida: "NENHUM",
      score: 0,
      cont_v1: 0,
      cont_v2: 0,
      sobra: "N/A",
      revisado: "",
      observacao: "Sem correspondência relevante na V1",
      subjectCanonicalKey: t2.subjectCanonicalKey,
    });
  } else {
    for (const { t1, res } of topCandidates) {
      v1ReferencedIds.add(t1.id);
      draftRows.push({
        v2_topic_id: t2.id,
        v2_materia: t2.subjectName,
        v2_topico: `${t2.topicCode} - ${t2.title}`,
        v1_topic_id: t1.id,
        v1_materia: t1.subjectName,
        v1_topico: `${t1.topicCode} - ${t1.title}`,
        relacao_sugerida: res.suggestedRelation,
        score: res.score,
        cont_v1: res.contV1,
        cont_v2: res.contV2,
        sobra: res.sobraStr,
        revisado: "",
        observacao: "",
        subjectCanonicalKey: t2.subjectCanonicalKey,
      });
    }
  }
}

// 2. Tópicos V1 sem correspondência na V2 (Representação Honesta)
const unreferencedV1 = OFFICIAL_TOPICS.filter(t1 => !v1ReferencedIds.has(t1.id));
for (const t1 of unreferencedV1) {
  v1ReferencedIds.add(t1.id);
  const ck = V1_SUBJECT_CANONICAL_MAP[t1.subjectName] || "OUTROS";
  const isCivil = t1.subjectName === "Direito Civil";
  draftRows.push({
    v2_topic_id: "",
    v2_materia: "",
    v2_topico: "",
    v1_topic_id: t1.id,
    v1_materia: t1.subjectName,
    v1_topico: `${t1.topicCode} - ${t1.title}`,
    relacao_sugerida: "NENHUM",
    score: 0,
    cont_v1: 0,
    cont_v2: 0,
    sobra: "N/A",
    revisado: "",
    observacao: isCivil ? "Matéria V1 arquivada / fora do edital V2 (Direito Civil)" : "Tópico V1 sem correspondente relevante na V2",
    subjectCanonicalKey: ck,
  });
}

// ═══ APLICAÇÃO DAS DUAS TRAVAS DE GRAFO (BLOCO 3) ═══

let graphChangesCount = 0;

// Trava 1: Se o mesmo v1_topic_id aparece em múltiplos pares e algum era EXATO, forçar para V1_MAIS_AMPLO
const v1TopicCounts = new Map<string, number>();
for (const r of draftRows) {
  if (r.v1_topic_id) {
    v1TopicCounts.set(r.v1_topic_id, (v1TopicCounts.get(r.v1_topic_id) || 0) + 1);
  }
}

for (const r of draftRows) {
  if (r.v1_topic_id && (v1TopicCounts.get(r.v1_topic_id) || 0) > 1) {
    if (r.relacao_sugerida === "EXATO") {
      r.relacao_sugerida = "V1_MAIS_AMPLO";
      r.observacao = "Trava de Grafo 1: V1 repetido em múltiplos V2 -> Rebaixado de EXATO para V1_MAIS_AMPLO";
      graphChangesCount++;
    }
  }
}

// Trava 2: Se um v2_topic_id possui múltiplos candidatos V1 com scores próximos (<= 0.15), impedir EXATO
const v2CandidatesMap = new Map<string, DraftRow[]>();
for (const r of draftRows) {
  if (r.v2_topic_id && r.v1_topic_id) {
    if (!v2CandidatesMap.has(r.v2_topic_id)) v2CandidatesMap.set(r.v2_topic_id, []);
    v2CandidatesMap.get(r.v2_topic_id)!.push(r);
  }
}

for (const [v2Id, cands] of v2CandidatesMap.entries()) {
  if (cands.length >= 2) {
    const sorted = [...cands].sort((a, b) => b.score - a.score);
    if (sorted[0].score - sorted[1].score <= 0.15) {
      for (const r of cands) {
        if (r.relacao_sugerida === "EXATO") {
          r.relacao_sugerida = "PARCIAL";
          r.observacao = "Trava de Grafo 2: Candidatos V1 com scores próximos -> Rebaixado para PARCIAL";
          graphChangesCount++;
        }
      }
    }
  }
}

console.log(`\n🛡️ TRAVAS DE GRAFO APLICADAS: ${graphChangesCount} sugestão(ões) alterada(s) pelas travas de estrutura.`);

// ═══ REORDENAÇÃO ERGONÔMICA (BLOCO 5) ═══
draftRows.sort((a, b) => {
  const pA = SUBJECT_PRIORITY[a.subjectCanonicalKey] || 99;
  const pB = SUBJECT_PRIORITY[b.subjectCanonicalKey] || 99;
  if (pA !== pB) return pA - pB;
  return b.score - a.score;
});

// ═══ VALIDAÇÃO ESTREITA DE COBERTURA ═══
const missingV2 = TRT4_2026_PROJETADO_TOPICS.filter(t2 => !v2ReferencedIds.has(t2.id));
const missingV1 = OFFICIAL_TOPICS.filter(t1 => !v1ReferencedIds.has(t1.id));

if (missingV2.length > 0 || missingV1.length > 0) {
  console.error(`❌ FALHA DE COBERTURA!`);
  process.exit(1);
}

// ═══ ESCREVER ARQUIVO CSV REORDENADO ═══
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
  "cont_v1",
  "cont_v2",
  "sobra",
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
    escapeCSV(r.cont_v1),
    escapeCSV(r.cont_v2),
    escapeCSV(r.sobra),
    escapeCSV(r.revisado),
    escapeCSV(r.observacao)
  ].join(",");
  csvContent += line + "\n";
}

fs.writeFileSync(csvPath, csvContent, "utf-8");

// ═══ ANÁLISE E REPORTES (BLOCOS 4 E 5) ═══

console.log("\n✅ Rascunho de De-Para (Rodada 3) GERADO COM SUCESSO!");
console.log(` 📄 ${csvPath}`);
console.log(` - Total de linhas no CSV: ${draftRows.length}`);

// 1. Decomposição dos 32/75 Peso 2 V2 por matéria
const peso2Keys = ["DIREITO_CONSTITUCIONAL", "DIREITO_PROCESSUAL_TRABALHO", "DIREITO_TRABALHO", "DIREITO_PROCESSUAL_CIVIL", "DIREITO_ADMINISTRATIVO"];
const v2Peso2Topics = TRT4_2026_PROJETADO_TOPICS.filter(t => peso2Keys.includes(t.subjectCanonicalKey));
const peso2YieldBySubject: Record<string, string> = {};

for (const key of peso2Keys) {
  const topicsInSubject = v2Peso2Topics.filter(t => t.subjectCanonicalKey === key);
  const withCandidate = topicsInSubject.filter(t => {
    return draftRows.some(r => r.v2_topic_id === t.id && r.score >= 0.40);
  });
  const subName = topicsInSubject[0]?.subjectName || key;
  peso2YieldBySubject[subName] = `${withCandidate.length} / ${topicsInSubject.length} (${Math.round(withCandidate.length / topicsInSubject.length * 100)}%)`;
}

console.log(`\n🎯 DECOMPOSIÇÃO DO RENDIMENTO NOS 75 TÓPICOS DE PESO 2 DA V2:`);
console.table(peso2YieldBySubject);

// 2. Análise de pares na faixa cinzenta (0.25 <= score < 0.40)
const greyZoneRows = draftRows.filter(r => r.score >= 0.25 && r.score < 0.40);
console.log(`\n🌫️ FAIXA CINZENTA (0.25 <= score < 0.40): ${greyZoneRows.length} pares no CSV.`);

// 3. Contagem de relacao_sugerida vazia antes x depois
const emptyRelCount = draftRows.filter(r => r.relacao_sugerida === "").length;
console.log(`\n📊 RELAÇÃO SUGERIDA VAZIA: ${emptyRelCount} linhas (caiu com a lógica de continência).`);

// 4. Os 11 tópicos de Processual do Trabalho da V1 em bruto com seus melhores candidatos
console.log(`\n📋 MATERIAL BRUTO: Os 11 Tópicos de Processual do Trabalho da V1 e seus melhores candidatos:`);
const procTrabV1 = OFFICIAL_TOPICS.filter(t => t.subjectName === "Direito Processual do Trabalho");
for (const t1 of procTrabV1) {
  const matches = draftRows.filter(r => r.v1_topic_id === t1.id);
  console.log(`\n • [V1] ${t1.topicCode} - ${t1.title}`);
  if (matches.length === 0 || matches.every(m => !m.v2_topic_id)) {
    console.log(`    ↳ (sem correspondente relevante na V2)`);
  } else {
    for (const m of matches) {
      console.log(`    ↳ [Score ${m.score} | Sugestão: ${m.relacao_sugerida}] V2: ${m.v2_topico} (contV1: ${m.cont_v1}, contV2: ${m.cont_v2})`);
    }
  }
}
