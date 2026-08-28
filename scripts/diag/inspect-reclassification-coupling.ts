import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(process.cwd(), "reclassificacao-final.json");
  const items: Array<{ id: string; de: string; para: string; assunto: string }> = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  console.log(`======================================================================`);
  console.log(`       ANÁLISE DE ACOPLAMENTO PARA OS ${items.length} CARDS A RECLASSIFICAR`);
  console.log(`======================================================================\n`);

  const cardIds = items.map(i => i.id);

  const cards = await prisma.flashcard.findMany({
    where: { id: { in: cardIds } },
    include: {
      subject: { select: { id: true, name: true } },
      studyBlock: { select: { id: true, title: true, subjectId: true, subject: { select: { name: true } } } },
      material: { select: { id: true, fileName: true, subjectId: true, subject: { select: { name: true } } } }
    }
  });

  console.log(`Total de cards encontrados no banco: ${cards.length}`);

  let cardsWithBlock = 0;
  let cardsWithoutBlock = 0;
  let cardsWithMaterial = 0;

  const subjectMap = new Map<string, string>(); // name -> id
  const allSubjects = await prisma.studySubject.findMany();
  allSubjects.forEach(s => subjectMap.set(s.name, s.id));

  let blocksMismatchingSubject = 0;

  cards.forEach(c => {
    if (c.studyBlockId) {
      cardsWithBlock++;
    } else {
      cardsWithoutBlock++;
    }

    if (c.materialId) {
      cardsWithMaterial++;
    }
  });

  console.log(`\n- Cards COM studyBlockId: ${cardsWithBlock}`);
  console.log(`- Cards SEM studyBlockId (blockId = null): ${cardsWithoutBlock}`);
  console.log(`- Cards COM materialId: ${cardsWithMaterial}\n`);

  // Para os cards que possuem bloco, vamos verificar se os blocos estão na matéria antiga ou nova
  console.log(`Detalhamento dos ${cardsWithBlock} cards que possuem studyBlockId:`);
  cards.forEach(c => {
    if (c.studyBlock) {
      const targetSubjectName = items.find(i => i.id === c.id)?.para;
      const blockSubjectName = c.studyBlock.subject?.name;
      console.log(`Card ${c.id}: SubjectAtual='${c.subject.name}' -> SubjectDestino='${targetSubjectName}' | BlockSubject='${blockSubjectName}' (Block: ${c.studyBlock.title})`);
    }
  });
}

main().finally(() => prisma.$disconnect());
