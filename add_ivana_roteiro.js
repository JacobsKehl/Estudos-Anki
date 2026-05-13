const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function main() {
  const sourcePath = 'C:\\Users\\henrique.kehl\\Downloads\\Roteiro - Gerente - Ivana.pdf';
  const uploadDir = path.join(process.cwd(), 'uploads', 'materials');
  const mockUserId = 'cm39k012x0001k93jqwerty12';
  
  // 1. Find a subject to attach to
  const subject = await prisma.studySubject.findFirst({
    where: { userId: mockUserId }
  });
  
  if (!subject) {
    console.error('No subject found for user');
    return;
  }

  // 2. Prepare destination
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const fileId = uuidv4();
  const destFileName = `${fileId}.pdf`;
  const destPath = path.join(uploadDir, destFileName);
  const dbFilePath = `/uploads/materials/${destFileName}`;

  // 3. Copy file
  fs.copyFileSync(sourcePath, destPath);
  const stats = fs.statSync(destPath);

  // 4. Create DB Entry
  const material = await prisma.studyMaterial.create({
    data: {
      userId: mockUserId,
      subjectId: subject.id,
      fileName: 'Roteiro - Gerente - Ivana.pdf',
      originalFileName: 'Roteiro - Gerente - Ivana.pdf',
      filePath: dbFilePath,
      mimeType: 'application/pdf',
      fileSize: stats.size,
      processingStatus: 'PENDING'
    }
  });

  console.log(`Material created: ${material.id}`);
  
  // 5. Trigger Process (simulating the POST request)
  // Instead of HTTP, we could run the logic directly, but let's just use the API if we can.
  // Since we are in Node, let's just wait and let the user click or we can use a small fetch.
  console.log(`To process, visit: http://localhost:3000/materials/${material.id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
