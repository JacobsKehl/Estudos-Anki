import fs from "fs";
import path from "path";

async function main() {
  const rootDup = path.join(process.cwd(), "duplicatas-final.json");
  const rootReclass = path.join(process.cwd(), "reclassificacao-final.json");

  const targetDir = path.join(process.cwd(), "docs/auditoria");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetDup = path.join(targetDir, "duplicatas-final.json");
  const targetReclass = path.join(targetDir, "reclassificacao-final.json");

  if (fs.existsSync(rootDup)) {
    fs.copyFileSync(rootDup, targetDup);
    console.log(`Copiado duplicatas-final.json -> docs/auditoria/duplicatas-final.json`);
  }

  if (fs.existsSync(rootReclass)) {
    fs.copyFileSync(rootReclass, targetReclass);
    console.log(`Copiado reclassificacao-final.json -> docs/auditoria/reclassificacao-final.json`);
  }
}

main();
