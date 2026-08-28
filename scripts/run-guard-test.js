const { spawnSync } = require("child_process");

process.env.RUN_CFC_BLUEPRINT_DB_TEST = "true";

const result = spawnSync("cmd.exe", ["/c", "npx jest src/__tests__/cfc/block-blueprint-integrity.test.ts --forceExit"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status || 0);
