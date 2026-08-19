import "dotenv/config";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("======================================================================");
  console.log("    PROVA DE PRODUÇÃO AUTENTICADA COM CONTROLE POSITIVO (ITEM 4)      ");
  console.log("======================================================================\n");

  const prodUrl = process.env.PRODUCTION_URL || process.env.NEXT_PUBLIC_APP_URL || "https://estudos-anki.vercel.app";
  const email = process.env.SMOKE_EMAIL || "gabriela.furtado.p@gmail.com";
  const password = process.env.SMOKE_PASSWORD || "123456";

  console.log(`Buscando sessão autenticada em: ${prodUrl}/api/auth/login (${email})`);

  let cookieHeader = "";
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const loginRes = await fetch(`${prodUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (loginRes.ok) {
        cookieHeader = loginRes.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
        console.log(`✅ Tentativa ${attempt}: Login efetuado com sucesso. Cookie obtido!`);
        break;
      } else if (loginRes.status === 429) {
        console.log(`⚠️ Tentativa ${attempt}: HTTP 429 (Rate Limit). Aguardando 4 segundos para retry...`);
        await sleep(4000);
      } else {
        throw new Error(`Falha HTTP ${loginRes.status}: ${loginRes.statusText}`);
      }
    } catch (err: any) {
      console.warn(`Erro na tentativa ${attempt}: ${err.message}`);
      await sleep(3000);
    }
  }

  if (!cookieHeader) {
    throw new Error("🔴 CRÍTICO: Não foi possível obter cookie de autenticação em produção após retries!");
  }

  // ------------------------------------------------------------------
  // 1. PÁGINA /subjects (COM CONTROLE POSITIVO)
  // ------------------------------------------------------------------
  console.log("\n--- 1. VERIFICAÇÃO AUTENTICADA DA PÁGINA /subjects ---");
  const subjRes = await fetch(`${prodUrl}/subjects`, {
    headers: {
      cookie: cookieHeader,
      "User-Agent": "Antigravity-Positive-Control-Verifier/1.0"
    }
  });

  const subjHtml = await subjRes.text();
  const dplMatch = subjHtml.match(/data-dpl-id="([^"]+)"/);
  const dplId = dplMatch ? dplMatch[1] : "não encontrado";

  console.log(`- Status HTTP: ${subjRes.status} ${subjRes.statusText}`);
  console.log(`- Deployment ID: ${dplId}`);
  console.log(`- Tamanho HTML: ${subjHtml.length.toLocaleString()} bytes`);

  // Controle Positivo (provar que a página logada foi renderizada)
  const hasSubjectName = subjHtml.includes("Direito Administrativo") || subjHtml.includes("Direito Constitucional");
  const hasCompletude = subjHtml.includes("completude");

  // Controle Negativo (provar que os erros foram removidos)
  const hasComplitude = subjHtml.includes("complitude");
  const has379 = subjHtml.includes("37,9%");
  const has483 = subjHtml.includes("48,3%");

  console.log(`\n[CONTROLE POSITIVO]`);
  console.log(` - Matéria da Gabriela presente ('Direito Administrativo'): ${hasSubjectName ? "SIM ✅" : "NÃO ❌"}`);
  console.log(` - Grafia correta presente ('completude'):                ${hasCompletude ? "SIM ✅" : "NÃO ❌"}`);

  console.log(`\n[CONTROLE NEGATIVO]`);
  console.log(` - Grafia errada ausente ('complitude'):                  ${!hasComplitude ? "SIM ✅ (Ausente)" : "NÃO ❌ (Presente)"}`);
  console.log(` - Porcentagem estática ausente ('37,9%'):                 ${!has379 ? "SIM ✅ (Ausente)" : "NÃO ❌ (Presente)"}`);
  console.log(` - Porcentagem estática ausente ('48,3%'):                 ${!has483 ? "SIM ✅ (Ausente)" : "NÃO ❌ (Presente)"}`);

  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  // 2. HOMEPAGE (/) (COM CONTROLE POSITIVO ADAPTATIVO DE ESTADO)
  // ------------------------------------------------------------------
  console.log("\n--- 2. VERIFICAÇÃO AUTENTICADA DA HOMEPAGE (/) ---");
  const homeRes = await fetch(`${prodUrl}/`, {
    headers: {
      cookie: cookieHeader,
      "User-Agent": "Antigravity-Positive-Control-Verifier/1.0"
    }
  });

  const homeHtml = await homeRes.text();
  console.log(`- Status HTTP: ${homeRes.status} ${homeRes.statusText}`);
  console.log(`- Tamanho HTML: ${homeHtml.length.toLocaleString()} bytes`);

  const hasDayDone = homeHtml.includes("Hoje está concluído");
  const hasNextDayBtn = homeHtml.includes("Estudar o próximo dia agora");
  const hasPendingTasks = homeHtml.includes("Ler este bloco") || homeHtml.includes("Atos Administrativos") || homeHtml.includes("Estudar agora");

  let homepageControlPassed = false;
  console.log(`\n[CONTROLE POSITIVO HOMEPAGE]`);
  if (hasPendingTasks) {
    console.log(` - Medição de Estado: Usuária possui tarefas teóricas pendentes ativas.`);
    console.log(` - Lista de tarefas pendentes renderizada: SIM ✅`);
    console.log(` - Banner 'Hoje está concluído' pulado com justificativa (dia em andamento) ℹ️`);
    homepageControlPassed = true;
  } else {
    console.log(` - Medição de Estado: Nenhuma tarefa pendente hoje.`);
    console.log(` - Título de dia concluído ('Hoje está concluído ✨'): ${hasDayDone ? "SIM ✅" : "NÃO ❌"}`);
    console.log(` - Botão de avanço ('Estudar o próximo dia agora'):     ${hasNextDayBtn ? "SIM ✅" : "NÃO ❌"}`);
    homepageControlPassed = hasDayDone && hasNextDayBtn;
  }

  // ------------------------------------------------------------------
  // VALIDAÇÃO DE PLACAR RÍGIDO E TRAVA DE EXIT CODE (ITEM 3)
  // ------------------------------------------------------------------
  const fs = await import("fs");
  const path = await import("path");
  const lastDplFile = path.join(process.cwd(), "scripts", "diag", ".last-deployment-id");
  let previousDplId = "";
  if (fs.existsSync(lastDplFile)) {
    previousDplId = fs.readFileSync(lastDplFile, "utf-8").trim();
  }

  fs.writeFileSync(lastDplFile, dplId);

  console.log(`\n[VALIDAÇÃO DE DEPLOYMENT & PLACAR]`);
  console.log(` - ID Anterior Gravado: '${previousDplId || "NENHUM"}'`);
  console.log(` - ID Atual em Produção: '${dplId}'`);

  const subjectsControlPassed = hasSubjectName && hasCompletude && !hasComplitude && !has379 && !has483;

  if (!subjectsControlPassed) {
    console.error(`\n🔴 FALHA CRÍTICA DE PLACAR: A página /subjects não passou em 100% dos controles!`);
    process.exit(1);
  }

  if (!homepageControlPassed) {
    console.error(`\n🔴 FALHA CRÍTICA DE PLACAR: A homepage não passou no controle positivo de estado!`);
    process.exit(1);
  }

  if (previousDplId && dplId !== "não encontrado" && dplId === previousDplId) {
    console.error(`\n🔴 FALHA DE DEPLOY: O Deployment ID ('${dplId}') não mudou desde a última execução!`);
    console.error("O código enviado não gerou um novo release em produção.");
    process.exit(1);
  }

  console.log("✅ TODOS OS CONTROLES PASSARAM COM PLACAR 100% LIMPO!");

  console.log("\n======================================================================");
  console.log("  PROVA DE PRODUÇÃO COM CONTROLE POSITIVO CONCLUÍDA COM SUCESSO        ");
  console.log("======================================================================\n");
}

main();
