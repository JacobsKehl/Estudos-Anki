import { execSync } from "child_process";

try {
  const sql = execSync(
    'npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script',
    { encoding: "utf-8" }
  );
  console.log("======================================================================");
  console.log("RAW SQL OUTPUT DE PRISMA MIGRATE DIFF:");
  console.log("======================================================================");
  console.log(sql);

  if (sql.includes("SyllabusVersion_single_active")) {
    console.error("\n🔴 ERRO DE SEGURANÇA OPERACIONAL (ABORTANDO SCRIPT DE MIGRATION):");
    console.error("  A saída do diff contém a tentativa de recriar 'SyllabusVersion_single_active' sem a cláusula WHERE ('isActive' = true).");
    console.error("  ESTA INSTRUÇÃO NUNCA DEVE SER APLICADA NO BANCO! Veja docs/ROLLBACK.md Seção 8.");
    process.exit(1);
  }
} catch (e: any) {
  console.error("Error executing diff:", e.message);
  process.exit(1);
}
