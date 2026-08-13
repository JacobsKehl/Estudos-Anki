import { extractProjectRef } from "../../lib/supabase-ref-extractor";

describe("Supabase Project Ref Extractor (Safety Guard)", () => {
  const PROD_REF = "msmdekjetxajcwuxmxps";
  const TEST_REF = "testdescartavelref123";

  test("1. Extrai ref da URL direta da produção (db.<ref>.supabase.co:5432)", () => {
    const directUrl = `postgresql://postgres:password123@db.${PROD_REF}.supabase.co:5432/postgres`;
    expect(extractProjectRef(directUrl)).toBe(PROD_REF);
  });

  test("2. Extrai ref da URL de pooler da produção (postgres.<ref>@aws...pooler.supabase.com:6543)", () => {
    const poolerUrl = `postgresql://postgres.${PROD_REF}:password123@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
    expect(extractProjectRef(poolerUrl)).toBe(PROD_REF);
  });

  test("3. Extrai ref da URL direta do projeto de teste (db.<ref>.supabase.co:5432)", () => {
    const directTestUrl = `postgresql://postgres:password123@db.${TEST_REF}.supabase.co:5432/postgres`;
    expect(extractProjectRef(directTestUrl)).toBe(TEST_REF);
  });

  test("4. Extrai ref da URL de pooler do projeto de teste (postgres.<ref>@aws...pooler.supabase.com:5432)", () => {
    const poolerTestUrl = `postgresql://postgres.${TEST_REF}:password123@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`;
    expect(extractProjectRef(poolerTestUrl)).toBe(TEST_REF);
  });

  test("5. Aborta/retorna null para URLs sem ref ou malformatadas", () => {
    expect(extractProjectRef("postgresql://postgres:password@localhost:5432/db")).toBeNull();
    expect(extractProjectRef("invalid-url")).toBeNull();
    expect(extractProjectRef("")).toBeNull();
  });

  test("6. Valida que refs de produção via Pooler (6543) e Direta (5432) são idênticos", () => {
    const prodPooler = `postgresql://postgres.${PROD_REF}:pass@aws-1-sa-east-1.pooler.supabase.com:6543/postgres`;
    const prodDirect = `postgresql://postgres:pass@db.${PROD_REF}.supabase.co:5432/postgres`;

    const refPooler = extractProjectRef(prodPooler);
    const refDirect = extractProjectRef(prodDirect);

    expect(refPooler).toBe(PROD_REF);
    expect(refDirect).toBe(PROD_REF);
    expect(refPooler).toBe(refDirect); // Detecta colisão por ref mesmo quando os hosts são totalmente diferentes!
  });
});
