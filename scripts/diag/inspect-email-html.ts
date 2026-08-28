import "dotenv/config";
import { generateEmailHtml } from "../../src/app/api/cron/reminder/route";

async function main() {
  console.log("=================================================================");
  console.log("  INSPEÇÃO DO HTML DO E-MAIL E DOS LINKS DO BOTÃO CTA");
  console.log("=================================================================\n");

  const mockTasks = [
    {
      type: "THEORY",
      subjectName: "Direito Administrativo",
      blockTitle: "Serviços Públicos",
      estimatedMinutes: 27,
      studyBlock: { pageStart: 6, pageEnd: 15 }
    }
  ];

  const appUrlFallback = process.env.APP_BASE_URL || "https://estudos-anki.vercel.app";

  const html = generateEmailHtml(
    "Gabriela",
    mockTasks,
    appUrlFallback,
    "MASCULINE_NEUTRAL",
    null
  );

  const hrefMatches = html.match(/href="([^"]+)"/g);
  console.log(`📌 Links (href) encontrados no HTML do e-mail:`);
  (hrefMatches || []).forEach((m, idx) => {
    console.log(`   ${idx + 1}. ${m}`);
  });

  console.log(`\n📌 Variável process.env.APP_BASE_URL no ambiente local: ${process.env.APP_BASE_URL ?? "NÃO DEFINIDA (Usando fallback seguro: https://estudos-anki.vercel.app)"}`);
}

main().catch(console.error);
