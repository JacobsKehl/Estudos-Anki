const { Client } = require('pg');

async function test() {
  const connectionString = "postgresql://postgres.msmdekjetxajcwuxmxps:EFWAg7wGNgVF4Uc3@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require";
  console.log("Connecting with sslmode=require...");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log("Connected successfully!");
    const res = await client.query('SELECT NOW()');
    console.log("Result:", res.rows);
    await client.end();
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

test();
