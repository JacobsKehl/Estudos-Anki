const assert = require("node:assert");
const { shouldRunDatabaseMigrations } = require("./vercel-build-policy");

console.log("=== RUNNING VERCEL BUILD POLICY TESTS ===");

// 1. {} -> false
assert.strictEqual(shouldRunDatabaseMigrations({}), false, "Empty env should not run migrations");

// 2. { VERCEL: "0" } -> false
assert.strictEqual(shouldRunDatabaseMigrations({ VERCEL: "0" }), false, "VERCEL=0 should not run migrations");

// 3. { VERCEL: "1" } -> false
assert.strictEqual(shouldRunDatabaseMigrations({ VERCEL: "1" }), false, "VERCEL=1 without VERCEL_ENV should not run migrations");

// 4. { VERCEL: "1", VERCEL_ENV: "preview" } -> false
assert.strictEqual(shouldRunDatabaseMigrations({ VERCEL: "1", VERCEL_ENV: "preview" }), false, "VERCEL_ENV=preview should not run migrations");

// 5. { VERCEL: "1", VERCEL_ENV: "development" } -> false
assert.strictEqual(shouldRunDatabaseMigrations({ VERCEL: "1", VERCEL_ENV: "development" }), false, "VERCEL_ENV=development should not run migrations");

// 6. { VERCEL: "1", VERCEL_ENV: "production" } -> true
assert.strictEqual(shouldRunDatabaseMigrations({ VERCEL: "1", VERCEL_ENV: "production" }), true, "VERCEL=1 and VERCEL_ENV=production should run migrations");

// 7. { VERCEL: "1", VERCEL_ENV: "unknown" } -> false
assert.strictEqual(shouldRunDatabaseMigrations({ VERCEL: "1", VERCEL_ENV: "unknown" }), false, "VERCEL_ENV=unknown should not run migrations");

// 8. { VERCEL: "true", VERCEL_ENV: "production" } -> false
assert.strictEqual(shouldRunDatabaseMigrations({ VERCEL: "true", VERCEL_ENV: "production" }), false, "VERCEL=true (string) should not run migrations");

// 9. Case-sensitive and whitespace tests
assert.strictEqual(shouldRunDatabaseMigrations({ VERCEL: "1", VERCEL_ENV: "Production" }), false, "Case differences in VERCEL_ENV should not run migrations");
assert.strictEqual(shouldRunDatabaseMigrations({ VERCEL: "1", VERCEL_ENV: "production " }), false, "Trailing whitespace in VERCEL_ENV should not run migrations");
assert.strictEqual(shouldRunDatabaseMigrations({ VERCEL: " 1", VERCEL_ENV: "production" }), false, "Leading whitespace in VERCEL should not run migrations");
assert.strictEqual(shouldRunDatabaseMigrations(null), false, "Null env should not run migrations");
assert.strictEqual(shouldRunDatabaseMigrations(undefined), false, "Undefined env should not run migrations");

console.log("✅ All VERCEL build policy tests passed successfully!");
