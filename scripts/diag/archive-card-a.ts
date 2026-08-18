import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cardId = "cmrif88vl000zjr04mjwpd89v";
  const survivingId = "cmq1hfxnw000bl504jazv1evb";

  console.log(`Arquivando Card A [${cardId}] sobre Jurisdição Voluntária...`);

  await prisma.flashcard.update({
    where: { id: cardId },
    data: {
      status: "ARCHIVED",
      generationReason: `ARCHIVED_DUPLICATE | surviving_id=${survivingId} | tema=Jurisdição Voluntária`
    }
  });

  console.log(`✅ Card A [${cardId}] arquivado com sucesso (status: ARCHIVED).`);
}

main().finally(() => prisma.$disconnect());
