import fs from "fs";
import path from "path";

async function main() {
  console.log("======================================================================");
  console.log("    CONTROLE POSITIVO DO INVARIANTE CONTRA O BACKUP PRÉ-CORREÇÃO      ");
  console.log("======================================================================\n");

  const backupPath = path.join(process.cwd(), "backups", "json", "pre-fix-6-shifted-boundaries.json");
  if (!fs.existsSync(backupPath)) {
    console.log(` ❌ Backup não encontrado em: ${backupPath}`);
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const blocks = snapshot.blocks || [];

  const cfcMaterials = [
    "1 - Direito Administrativo_compressed.pdf",
    "3 - Direito Constitucional.pdf",
    "Direito Processual Civil_compressed.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "2 - Direito do Trabalho.pdf"
  ];

  let totalGaps = 0;
  let totalOverlaps = 0;

  for (const mName of cfcMaterials) {
    const matBlocks = blocks.filter((b: any) => b.StudyMaterial?.originalFileName === mName || b.materialId);
    // Para blocos do backup sem join expandido
    matBlocks.sort((a: any, b: any) => a.pageStart - b.pageStart);

    for (let i = 0; i < matBlocks.length - 1; i++) {
      const curr = matBlocks[i];
      const next = matBlocks[i + 1];

      if (curr.pageEnd + 1 < next.pageStart) {
        totalGaps++;
      } else if (curr.pageEnd >= next.pageStart) {
        totalOverlaps++;
      }
    }
  }

  console.log(` Resultado do Teste no Backup Pré-Correção:`);
  console.log(` Total de Lacunas Detectadas: ${totalGaps}`);
  console.log(` Total de Sobreposições Detectadas: ${totalOverlaps}`);
  console.log("======================================================================\n");
}

main().catch(console.error);
