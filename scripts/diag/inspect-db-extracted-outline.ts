import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const materialId = "cmss0jkx6004nl604md2gsthj";

  // Check ExtractedContent or StudyBlockSupport for pages 89 to 115
  const { data: contents } = await supabase
    .from("ExtractedContent")
    .select("pageNumber, rawText, title, sectionHeading")
    .eq("materialId", materialId)
    .gte("pageNumber", 89)
    .lte("pageNumber", 115)
    .order("pageNumber", { ascending: true });

  console.log("======================================================================");
  console.log(`    SUMÁRIO E TÍTULOS EXTRAÍDOS DO BANCO (PÁGINAS 89 A 115)           `);
  console.log("======================================================================\n");

  if (!contents || contents.length === 0) {
    // Try querying StudyBlockSupport or StudyBlock source headings
    const { data: supports } = await supabase
      .from("StudyBlockSupport")
      .select("*")
      .eq("materialId", materialId);

    console.log(`Supports count for material: ${supports?.length || 0}`);
    if (supports && supports.length > 0) {
      supports.slice(0, 15).forEach(s => console.log(s));
    }
    return;
  }

  contents.forEach(c => {
    console.log(`--- PÁGINA ${c.pageNumber} ---`);
    if (c.title) console.log(`   📌 Título: "${c.title}"`);
    if (c.sectionHeading) console.log(`   📌 Seção: "${c.sectionHeading}"`);
    const text = c.rawText || "";
    // Extract potential level 2 / 3 headings or uppercase lines
    const headings = text.split("\n").filter((line: string) => {
      const trimmed = line.trim();
      return /^(\d+\.\d+|\d+\s*[-–]\s*|[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,40}$)/.test(trimmed);
    });
    if (headings.length > 0) {
      headings.forEach((h: string) => console.log(`      -> "${h.trim()}"`));
    } else {
      console.log(`   Snippet: ${text.substring(0, 120).replace(/\s+/g, " ")}...`);
    }
  });
}

main();
