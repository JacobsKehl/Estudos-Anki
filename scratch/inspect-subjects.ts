import { prisma } from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  console.log("Listing all study subjects in database:");
  const subjects = await prisma.studySubject.findMany();
  for (const s of subjects) {
    console.log(`- ID: ${s.id} | Name: ${s.name} | UserID: ${s.userId}`);
  }
}

main().catch(console.error);
