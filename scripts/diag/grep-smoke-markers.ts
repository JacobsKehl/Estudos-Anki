import fs from "fs";
import path from "path";

function grepFile(fileName: string, patterns: string[]) {
  const filePath = path.join(process.cwd(), "tmp", "smoke", fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Arquivo não encontrado: ${fileName}`);
    return;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  console.log(`======================================================================`);
  console.log(`📄 Arquivo: tmp/smoke/${fileName} (${fs.statSync(filePath).size} bytes)`);
  console.log(`======================================================================`);

  patterns.forEach(pat => {
    const regex = new RegExp(pat, "gi");
    const matches = content.match(regex);
    if (matches) {
      console.log(`   ✅ Encontrado padrão "${pat}": ${matches.length} ocorrência(s)`);
      // Exibir trechos em torno do padrão
      const idx = content.search(regex);
      if (idx !== -1) {
        const snippet = content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 200)).replace(/\n/g, " ");
        console.log(`      Snippet: "...${snippet}..."`);
      }
    } else {
      console.log(`   ❌ Padrão "${pat}" NÃO encontrado.`);
    }
  });
  console.log("\n");
}

console.log("AUDITORIA DE GREP NOS ARQUIVOS HTML DO SMOKE TEST EM PRODUÇÃO:\n");

grepFile("subjects.html", [
  "CFC",
  "19 blocos",
  "48,3",
  "15,5",
  "SubjectPossiblyStudiedBanner"
]);

grepFile("anchor_precredit.html", [
  "PossiblyStudiedCard",
  "Já estudei",
  "Ainda não",
  "Atos Administrativos"
]);

grepFile("anchor_completed.html", [
  "Concluído",
  "COMPLETED",
  "Organização da Administração Pública"
]);

grepFile("schedule_today.html", [
  "CFC",
  "Estratégia",
  "MAIN_MATERIAL",
  "Direito"
]);
