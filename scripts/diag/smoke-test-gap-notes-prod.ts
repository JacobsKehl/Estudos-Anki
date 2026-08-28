import "dotenv/config";
import fs from "fs";
import path from "path";

async function main() {
  console.log("======================================================================");
  console.log("SMOKE TEST EM PRODUÇÃO: VERIFICAÇÃO F2 (SEÇÃO 'O QUE O CFC NÃO COBRE')");
  console.log("======================================================================\n");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estudos-anki.vercel.app";
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;

  if (!email || !password) {
    throw new Error("SMOKE_EMAIL ou SMOKE_PASSWORD não configurados no .env!");
  }

  // 1. Fazer login
  console.log(`Autenticando contra ${baseUrl}/api/auth/login...`);
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!loginRes.ok) {
    throw new Error(`Falha no login: HTTP ${loginRes.status}`);
  }

  const cookieHeader = loginRes.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");

  // 2. Baixar HTML do Bloco 1: Recursos Trabalhistas (READY)
  const blockReadyId = "cmss361lj004hiyaodwrvf1xa";
  const urlReady = `${baseUrl}/blocks/${blockReadyId}`;
  console.log(`Baixando HTML de produção do Bloco READY: ${urlReady}...`);
  
  const resReady = await fetch(urlReady, { headers: { cookie: cookieHeader } });
  const htmlReady = await resReady.text();
  
  const dirPath = path.join(process.cwd(), "tmp", "smoke");
  fs.mkdirSync(dirPath, { recursive: true });
  
  const fileReadyPath = path.join(dirPath, "recursos_trab_prod.html");
  fs.writeFileSync(fileReadyPath, htmlReady, "utf-8");

  console.log(`✅ Salvo: ${fileReadyPath} (${htmlReady.length.toLocaleString()} bytes)\n`);

  // Greps do Bloco READY
  const readyHasSection = htmlReady.includes("O que o CFC não cobre");
  const readyHasAgravo = htmlReady.includes("Agravo Interno");
  const readyHasSumula283 = htmlReady.includes("Súmula 283");

  console.log("----------------------------------------------------------------------");
  console.log("GREP 1: BLOCO RECURSOS TRABALHISTAS (READY):");
  console.log("----------------------------------------------------------------------");
  console.log(`- 'O que o CFC não cobre': ${readyHasSection ? "ENCONTRADO ✅" : "NÃO ENCONTRADO ❌"}`);
  console.log(`- 'Agravo Interno':         ${readyHasAgravo ? "ENCONTRADO ✅" : "NÃO ENCONTRADO ❌"}`);
  console.log(`- 'Súmula 283':             ${readyHasSumula283 ? "ENCONTRADO ✅" : "NÃO ENCONTRADO ❌"}\n`);

  // 3. Baixar HTML do Bloco 2: Glossário de Siglas (NOT_REQUIRED)
  const blockNotReqId = "cmss35erb0001iyao49fdckao";
  const urlNotReq = `${baseUrl}/blocks/${blockNotReqId}`;
  console.log(`Baixando HTML de produção do Bloco NOT_REQUIRED: ${urlNotReq}...`);

  const resNotReq = await fetch(urlNotReq, { headers: { cookie: cookieHeader } });
  const htmlNotReq = await resNotReq.text();

  const fileNotReqPath = path.join(dirPath, "glossario_siglas_prod.html");
  fs.writeFileSync(fileNotReqPath, htmlNotReq, "utf-8");

  console.log(`✅ Salvo: ${fileNotReqPath} (${htmlNotReq.length.toLocaleString()} bytes)\n`);

  // Greps do Bloco NOT_REQUIRED
  const notReqHasSection = htmlNotReq.includes("O que o CFC não cobre");
  const notReqHasPhrase = htmlNotReq.includes("Sem material de consulta do Estratégia para este tópico — o resumo do CFC é sua fonte principal.");

  console.log("----------------------------------------------------------------------");
  console.log("GREP 2: BLOCO GLOSSÁRIO DE SIGLAS (NOT_REQUIRED):");
  console.log("----------------------------------------------------------------------");
  console.log(`- 'O que o CFC não cobre': ${notReqHasSection ? "ENCONTRADO ✅" : "NÃO ENCONTRADO ❌"}`);
  console.log(`- Frase de Fonte Única:   ${notReqHasPhrase ? "ENCONTRADO ✅" : "NÃO ENCONTRADO ❌"}\n`);

  if (readyHasSection && readyHasAgravo && readyHasSumula283 && notReqHasSection && notReqHasPhrase) {
    console.log("🎉 TELA DO F2 ENTREGUE E COMPROVADA 100% EM PRODUÇÃO!");
  } else {
    console.error("🔴 ALGUNS TERMOS NÃO FORAM ENCONTRADOS NO HTML DE PRODUÇÃO!");
  }
}

main().catch(console.error);
