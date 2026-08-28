import "dotenv/config";
import { JSDOM } from "jsdom";

async function main() {
  console.log("=== INSPEÇÃO DIRETA DO HTML SSR DE HTTPS://KEHLSTUDY.COM (HOME) ===\n");
  const prodUrl = "https://kehlstudy.com";

  // 1. Authenticate via API
  const loginRes = await fetch(`${prodUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gabriela.furtado.p@gmail.com", password: "12345678" }),
  });

  const cookieHeader = loginRes.headers.get("set-cookie") || "";
  console.log(`Login HTTP Status: ${loginRes.status}`);

  // 2. Fetch Home Page HTML
  const homeRes = await fetch(`${prodUrl}/`, {
    headers: {
      cookie: cookieHeader,
      "User-Agent": "Antigravity-Inspector/1.0",
    },
  });

  const html = await homeRes.text();
  console.log(`Home HTTP Status: ${homeRes.status}, HTML size: ${html.length} bytes\n`);

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Extrair texto dos cards de tarefas e cabeçalhos
  const taskCards = Array.from(doc.querySelectorAll("[data-task-card], .border-border\\/50, .rounded-2xl"));
  
  console.log("--- CONTEÚDO VISÍVEL DA TELA DA GABRIELA HOJE ---");

  // Procurar títulos de blocos no HTML
  const titles = [
    "CONTROLE DA ADMINISTRAÇÃO PÚBLICA",
    "TUTELA PROVISÓRIA",
    "CONTRATOS ESPECIAIS DE TRABALHO",
    "PRESCRIÇÃO NO DIREITO PROCESSUAL DO TRABALHO",
    "Agentes Públicos — Conceito",
    "Poder Legislativo — Funções",
    "Férias Anuais",
    "Da Execução"
  ];

  for (const t of titles) {
    const present = html.includes(t);
    console.log(`- "${t}": ${present ? "✅ PRESENTE NA TELA" : "❌ NÃO PRESENTE (FILTRADO/DESCARTADO)"}`);
  }

  // Extrair badges de minutos presentes
  console.log("\n--- BUSCA POR TEXTO DE MINUTOS NO HTML ---");
  const minuteMatches = html.match(/\b\d+\s*min\b/gi) || [];
  console.log(`Ocorrências de minutos encontradas na tela: ${JSON.stringify(Array.from(new Set(minuteMatches)))}`);

  // Extrair o badge total de estudo
  const totalMinMatch = html.match(/(\d+)\s*min\s*de estudo/i);
  if (totalMinMatch) {
    console.log(`\nBadge Total de Estudo na tela: "${totalMinMatch[0]}"`);
  }
}

main().catch(console.error);
