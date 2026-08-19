import "dotenv/config";

async function main() {
  const prodUrl = "https://estudos-anki.vercel.app";
  
  // 1. Authenticate
  const loginRes = await fetch(`${prodUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gabriela.furtado.p@gmail.com", password: "12345678" })
  });

  const cookieHeader = loginRes.headers.get("set-cookie") || "";
  const loginBody = await loginRes.json().catch(() => ({}));
  console.log(`Login status: ${loginRes.status}, Cookie Header length: ${cookieHeader.length}, Body:`, loginBody);

  // 2. Fetch /subjects
  const subjRes = await fetch(`${prodUrl}/subjects`, {
    headers: {
      cookie: cookieHeader,
      "User-Agent": "Antigravity-Inspector/1.0"
    }
  });

  const html = await subjRes.text();
  console.log(`HTTP ${subjRes.status}, HTML length: ${html.length} bytes`);

  const hasPanelTitle = html.includes("Painel de Confirmação de Blocos");
  const hasAtosAdmin = html.includes("Atos Administrativos");

  console.log(`- 'Painel de Confirmação de Blocos' in HTML: ${hasPanelTitle}`);
  console.log(`- 'Atos Administrativos' in HTML: ${hasAtosAdmin}`);

  if (!hasPanelTitle) {
    console.log("\nSnippet of HTML (first 1000 chars):");
    console.log(html.substring(0, 1000));
  }
}

main();
