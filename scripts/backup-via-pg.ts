import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { getPrismaModelNames, scanForSensitiveData, BackupManifest } from "./backup-via-rest";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

export function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

async function main() {
  const args = process.argv.slice(2);
  const rotulo = args[0] || "pre-migrations";

  console.log(`\n======================================================================`);
  console.log(`  EXECUTANDO BACKUP COMPLETO VIA DATABASE TCP RAW 5432/6543: [${rotulo}]`);
  console.log(`======================================================================\n`);

  const modelNames = getPrismaModelNames();
  console.log(`📋 Tabelas extraídas dinamicamente do schema.prisma (${modelNames.length}):`);
  console.log(`   ${modelNames.join(", ")}\n`);

  const backupTargetDir = path.join(process.cwd(), "backups", "json", rotulo);
  if (!fs.existsSync(backupTargetDir)) {
    fs.mkdirSync(backupTargetDir, { recursive: true });
  }

  const manifestData: BackupManifest = {
    rotulo,
    timestamp: new Date().toISOString(),
    supabaseUrl: "TCP_DATABASE_CONNECTION",
    usedServiceRoleKey: true,
    totalTables: modelNames.length,
    totalRecords: 0,
    totalSizeBytes: 0,
    cpfScanClean: true,
    cpfOccurrencesCount: 0,
    tables: {},
  };

  let totalCpfMatches = 0;
  let totalRecordsSum = 0;

  for (const modelName of modelNames) {
    console.log(`📥 Baixando tabela '${modelName}' via TCP Raw SQL...`);
    
    let rows: any[] = [];
    try {
      rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${modelName}"`);
    } catch (err: any) {
      if (err.message.includes("does not exist") || err.message.includes("42P01")) {
        console.warn(`  ⚠️ Tabela '${modelName}' ainda não existe fisicamente no banco.`);
        rows = [];
      } else {
        throw err;
      }
    }

    const jsonStr = JSON.stringify(rows, null, 2);
    const sizeBytes = Buffer.byteLength(jsonStr, "utf-8");
    const sha256 = computeSha256(jsonStr);

    const filePath = path.join(backupTargetDir, `${modelName}.json`);
    fs.writeFileSync(filePath, jsonStr, "utf-8");

    const scan = scanForSensitiveData(jsonStr);
    if (!scan.clean) {
      console.warn(`  ⚠️ ENCONTRADAS ${scan.matchesCount} OCORRÊNCIAS DE CPF NA TABELA '${modelName}'!`);
      totalCpfMatches += scan.matchesCount;
    }

    manifestData.tables[modelName] = {
      recordCount: rows.length,
      sizeBytes,
      sha256,
    };

    totalRecordsSum += rows.length;
    manifestData.totalSizeBytes += sizeBytes;

    console.log(`   -> Guardado em ${modelName}.json (${rows.length} registros, ${(sizeBytes / 1024).toFixed(1)} KB)`);
  }

  manifestData.totalRecords = totalRecordsSum;
  manifestData.cpfScanClean = totalCpfMatches === 0;
  manifestData.cpfOccurrencesCount = totalCpfMatches;

  console.log(`\n======================================================================`);
  console.log(`  VERIFICAÇÃO DE INTEGRIDADE E COMPARATIVO CONTRA BASELINE (cp2b)`);
  console.log(`======================================================================\n`);

  const studyBlockFile = path.join(backupTargetDir, "StudyBlock.json");
  const flashcardFile = path.join(backupTargetDir, "Flashcard.json");

  if (fs.existsSync(studyBlockFile) && fs.existsSync(flashcardFile)) {
    const studyBlocks: any[] = JSON.parse(fs.readFileSync(studyBlockFile, "utf-8"));
    const flashcards: any[] = JSON.parse(fs.readFileSync(flashcardFile, "utf-8"));

    const userFile = path.join(backupTargetDir, "User.json");
    let gabrielaUserId = "cmp8od0wz0000iybklaotfqbs";
    if (fs.existsSync(userFile)) {
      const users: any[] = JSON.parse(fs.readFileSync(userFile, "utf-8"));
      const gabriela = users.find((u) => u.email === "gabriela.furtado.p@gmail.com");
      if (gabriela) gabrielaUserId = gabriela.id;
    }

    const gabrielaBlocks = studyBlocks.filter((b) => b.userId === gabrielaUserId);
    const gabrielaCompletedTheoryCount = gabrielaBlocks.filter((b) => b.theoryStatus === "COMPLETED").length;
    const gabrielaFlashcards = flashcards.filter((f) => f.userId === gabrielaUserId);
    const gabrielaBlockIds = new Set(gabrielaBlocks.map((b) => b.id));
    const gabrielaOrphanFlashcards = gabrielaFlashcards.filter((f) => f.studyBlockId && !gabrielaBlockIds.has(f.studyBlockId)).length;

    // Localizar manifesto anterior para comparação dinâmica
    const jsonBaseDir = path.join(process.cwd(), "backups", "json");
    let previousManifest: any = null;
    let previousDirName = "";

    if (fs.existsSync(jsonBaseDir)) {
      const subdirs = fs.readdirSync(jsonBaseDir)
        .filter(d => d !== rotulo && fs.existsSync(path.join(jsonBaseDir, d, "manifest.json")));
      if (subdirs.length > 0) {
        // Ordenar por mtime descendente para pegar o mais recente
        subdirs.sort((a, b) => {
          const statA = fs.statSync(path.join(jsonBaseDir, a, "manifest.json"));
          const statB = fs.statSync(path.join(jsonBaseDir, b, "manifest.json"));
          return statB.mtimeMs - statA.mtimeMs;
        });
        previousDirName = subdirs[0];
        previousManifest = JSON.parse(fs.readFileSync(path.join(jsonBaseDir, previousDirName, "manifest.json"), "utf-8"));
      }
    }

    const prevGabBlocks = previousManifest?.gabrielaMetrics?.totalStudyBlocks ?? gabrielaBlocks.length;
    const prevGabCompleted = previousManifest?.gabrielaMetrics?.completedTheoryCount ?? gabrielaCompletedTheoryCount;
    const prevGabCards = previousManifest?.gabrielaMetrics?.totalFlashcards ?? 862;

    console.log(` ── Escopo Gabriela (${gabrielaUserId}) ──`);
    console.log(` - Total StudyBlocks:   ${gabrielaBlocks.length} (Base ${previousDirName || "novo"}: ${prevGabBlocks}) ${gabrielaBlocks.length >= prevGabBlocks ? "✅" : "⚠️"}`);
    console.log(` - Teoria COMPLETED:    ${gabrielaCompletedTheoryCount} (Base ${previousDirName || "novo"}: ${prevGabCompleted}) ${gabrielaCompletedTheoryCount >= prevGabCompleted ? "✅" : "⚠️"}`);
    console.log(` - Total Flashcards:    ${gabrielaFlashcards.length} (Base ${previousDirName || "novo"}: ${prevGabCards}) ${gabrielaFlashcards.length >= prevGabCards ? "✅" : "⚠️"}`);
    console.log(` - Flashcards Órfãos:   ${gabrielaOrphanFlashcards} (Esperado: 0) ${gabrielaOrphanFlashcards === 0 ? "✅" : "❌"}`);

    (manifestData as any).gabrielaMetrics = {
      totalStudyBlocks: gabrielaBlocks.length,
      completedTheoryCount: gabrielaCompletedTheoryCount,
      totalFlashcards: gabrielaFlashcards.length,
      orphanFlashcards: gabrielaOrphanFlashcards,
    };

    console.log(` ── Escopo Global ──`);
    console.log(` - Total StudyBlocks:   ${studyBlocks.length}`);
    console.log(` - Total Flashcards:    ${flashcards.length}`);

    if (gabrielaOrphanFlashcards !== 0) {
      console.error(`\n❌ ERRO FATAL NO BACKUP VIA DB TCP: [VERIFICAÇÃO DE INTEGRIDADE FALHOU] Flashcards órfãos (${gabrielaOrphanFlashcards}) > 0! Abortando.`);
      process.exit(1);
    }
  }

  // Write manifest.json
  const manifestPath = path.join(backupTargetDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), "utf-8");

  console.log(`\n✅ MANIFESTO GRAVADO EM: backups/json/${rotulo}/manifest.json`);
  console.log(`   Tamanho Total do Payload JSON: ${(manifestData.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`   Varredura por CPF: ${manifestData.cpfScanClean ? "LIMPO (0 CPFs)" : `ATENÇÃO (${totalCpfMatches} CPFs encontrados)`}`);
  console.log(`\n🏆 BACKUP FRESCO [${rotulo.toUpperCase()}] AUTO-VERIFICADO COM SUCESSO!\n`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error("\n❌ ERRO FATAL NO BACKUP VIA DB TCP:", err.message);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
