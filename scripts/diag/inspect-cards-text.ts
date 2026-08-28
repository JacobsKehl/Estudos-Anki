import "dotenv/config";
import { JSDOM } from "jsdom";

async function main() {
  const prodUrl = "https://kehlstudy.com";

  const loginRes = await fetch(`${prodUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gabriela.furtado.p@gmail.com", password: "12345678" }),
  });

  const cookieHeader = loginRes.headers.get("set-cookie") || "";

  const homeRes = await fetch(`${prodUrl}/`, {
    headers: {
      cookie: cookieHeader,
      "User-Agent": "Antigravity-Inspector/1.0",
    },
  });

  const html = await homeRes.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  console.log("=== TODOS OS TÍTULOS E SUBTÍTULOS RENDERIZADOS NA SEÇÃO ESTUDO DO DIA ===");
  
  // Pegar todos os elementos que contém os cards
  const cardElements = doc.querySelectorAll("h3, h4, .font-semibold, .font-bold");
  const extractedTexts: string[] = [];

  cardElements.forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length > 3 && !extractedTexts.includes(text)) {
      extractedTexts.push(text);
    }
  });

  console.log(extractedTexts.slice(0, 30).join("\n"));
}

main().catch(console.error);
