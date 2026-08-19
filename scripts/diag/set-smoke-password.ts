import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const DEDICATED_SMOKE_USER_EMAIL = "smoke-tester@estudosanki.internal";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const targetEmail = process.argv[2] || DEDICATED_SMOKE_USER_EMAIL;

  if (targetEmail !== DEDICATED_SMOKE_USER_EMAIL) {
    console.error(`[BLOCKED] Safety Violation: set-smoke-password.ts is locked and ONLY permits setting passwords for ${DEDICATED_SMOKE_USER_EMAIL}. Target "${targetEmail}" rejected.`);
    process.exit(1);
  }

  const { data: user, error: findError } = await supabase
    .from("User")
    .select("authUserId, email")
    .eq("email", DEDICATED_SMOKE_USER_EMAIL)
    .single();

  if (findError || !user) {
    console.error(`Dedicated smoke test user (${DEDICATED_SMOKE_USER_EMAIL}) not found in User table:`, findError);
    process.exit(1);
  }

  const password = process.env.SMOKE_PASSWORD;
  if (!password) {
    console.error("SMOKE_PASSWORD environment variable is not defined.");
    process.exit(1);
  }

  console.log(`Setting password for dedicated test user ${user.email}...`);

  const { error } = await supabase.auth.admin.updateUserById(user.authUserId, {
    password
  });

  if (error) {
    console.error("Error setting password for smoke user:", error);
    process.exit(1);
  } else {
    console.log("Successfully set password for dedicated smoke test user!");
  }
}

main();
