import fs from "fs";
import path from "path";

async function main() {
  const src = path.join(process.cwd(), "backups", "json", "pre-migrations");
  const dest = path.join(process.cwd(), "backups", "json", "pre-f2-batch");

  if (fs.existsSync(src)) {
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.cpSync(src, dest, { recursive: true });
    console.log(`Backup copiado com sucesso para ${dest}`);

    const manifestPath = path.join(dest, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      manifest.rotulo = "pre-f2-batch";
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
      console.log(`Rótulo atualizado para 'pre-f2-batch' no manifesto.`);
    }
  }
}

main();
