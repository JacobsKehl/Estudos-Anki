import fs from "fs";
import path from "path";

function walkDir(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== ".git") {
        walkDir(filePath, fileList);
      }
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function main() {
  const srcDir = path.join(process.cwd(), "src");
  const files = walkDir(srcDir);
  let updatedCount = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, "utf-8");
    if (content.includes("getMockUserId")) {
      content = content.replace(/getMockUserId/g, "getCurrentUserId");
      fs.writeFileSync(file, content, "utf-8");
      console.log(`Updated: ${path.relative(process.cwd(), file)}`);
      updatedCount++;
    }
  }

  // Remove getMockUserId from src/lib/auth-mock.ts
  const authMockPath = path.join(srcDir, "lib", "auth-mock.ts");
  let authContent = fs.readFileSync(authMockPath, "utf-8");
  
  // Clean up deprecated getMockUserId export
  const deprecatedSnippet = `/**
 * Helper legível e compatível temporariamente para as rotas que ainda usam getMockUserId.
 * @deprecated Use getCurrentUserId() em vez disso.
 */
export async function getCurrentUserId(): Promise<string> {
  return getCurrentUserId();
}`;

  authContent = authContent.replace(deprecatedSnippet, "");
  fs.writeFileSync(authMockPath, authContent, "utf-8");

  console.log(`\nRefactoring complete! Updated ${updatedCount} files.`);
}

main().catch(console.error);
