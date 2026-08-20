import { execSync } from "child_process";

try {
  const output = execSync("npx jest --no-cache", { encoding: "utf-8" });
  console.log("=== SAÍDA INTEGRAL DO JEST ===");
  console.log(output);
} catch (err: any) {
  console.log("=== SAÍDA INTEGRAL DO JEST (STDERR/STDOUT) ===");
  console.log(err.stdout || "");
  console.log(err.stderr || "");
}
