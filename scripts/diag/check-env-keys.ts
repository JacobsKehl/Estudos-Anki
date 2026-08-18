import fs from "fs";
import path from "path";

async function main() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    console.log("Arquivo .env não encontrado localmente.");
    return;
  }

  const content = fs.readFileSync(envPath, "utf-8");
  const lines = content.split(/\r?\n/);
  const keys: string[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const key = trimmed.split("=")[0].trim();
      keys.push(key);
    }
  });

  console.log("=== CHAVES DE VARIÁVEIS DE AMBIENTE NO .ENV LOCAL (SEGURA / SEM VALORES) ===");
  console.log(`Total de chaves encontradas: ${keys.length}\n`);
  keys.sort().forEach(k => console.log(` - ${k}`));
}

main();
