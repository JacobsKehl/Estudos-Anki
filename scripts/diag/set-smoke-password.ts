import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data: user } = await supabase
    .from("User")
    .select("authUserId, email")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();

  const password = process.env.SMOKE_PASSWORD || "12345678";

  console.log(`Setting password for ${user!.email} (authUserId: ${user!.authUserId})...`);

  const { data, error } = await supabase.auth.admin.updateUserById(user!.authUserId, {
    password
  });

  if (error) {
    console.error("Error setting password:", error);
  } else {
    console.log("Successfully set password for Gabriela in Supabase Auth!");
  }
}

main();
