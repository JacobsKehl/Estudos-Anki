import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    ANÁLISE EMPÍRICA DOS REGISTROS DE SESSÃO (StudySessionLog)       ");
  console.log("======================================================================\n");

  const { data: logs, count, error } = await supabase
    .from("StudySessionLog")
    .select("*", { count: "exact" });

  if (error) {
    console.error("Erro ao buscar StudySessionLog:", error);
    return;
  }

  console.log(`Total de logs encontrados na tabela: ${count}`);

  if (!logs || logs.length === 0) {
    console.log("Nenhum log de sessão encontrado.");
    return;
  }

  // Agrupar por tipo / atividade
  const byType: Record<string, number> = {};
  const durationsMins: number[] = [];
  const theoryDurationsMins: number[] = [];
  const reviewDurationsMins: number[] = [];

  logs.forEach((log: any) => {
    const sessionType = log.sessionType || log.type || "DESCONHECIDO";
    byType[sessionType] = (byType[sessionType] || 0) + 1;

    let durationMins = log.durationMinutes || log.durationMins || 0;
    if (!durationMins && log.startedAt && log.completedAt) {
      const start = new Date(log.startedAt).getTime();
      const end = new Date(log.completedAt).getTime();
      durationMins = Math.round((end - start) / (1000 * 60));
    }

    if (durationMins > 0 && durationMins < 300) { // filtrar outliers de sessão esquecida aberta (> 5h)
      durationsMins.push(durationMins);
      if (sessionType.toUpperCase().includes("THEORY") || sessionType.toUpperCase().includes("READING") || sessionType.toUpperCase().includes("STUDY")) {
        theoryDurationsMins.push(durationMins);
      } else if (sessionType.toUpperCase().includes("REVIEW") || sessionType.toUpperCase().includes("REVISION")) {
        reviewDurationsMins.push(durationMins);
      }
    }
  });

  console.log("\n--- DISTRIBUIÇÃO DOS LOGS POR TIPO ---");
  console.table(byType);

  const getStats = (arr: number[]) => {
    if (arr.length === 0) return { count: 0, median: "N/A", mean: "N/A", min: "N/A", max: "N/A", p25: "N/A", p75: "N/A" };
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    return {
      count: sorted.length,
      median: `${median} min`,
      mean: `${(sum / sorted.length).toFixed(1)} min`,
      min: `${sorted[0]} min`,
      max: `${sorted[sorted.length - 1]} min`,
      p25: `${p25} min`,
      p75: `${p75} min`
    };
  };

  console.log("\n--- ESTATÍSTICAS DE DURAÇÃO DAS SESSÕES UTILIZÁVEIS ---");
  console.log("Todas as Sessões Validáveis:", getStats(durationsMins));
  console.log("Sessões de Leitura Teórica:", getStats(theoryDurationsMins));
  console.log("Sessões de Releitura / Revisão de Bloco:", getStats(reviewDurationsMins));
}

main();
