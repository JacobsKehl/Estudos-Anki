import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data: user, error: uErr } = await supabase
    .from("User")
    .select("id, email, authUserId")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();

  console.log("User in Prisma DB:", user);

  if (user?.authUserId) {
    const { data: authUser, error: aErr } = await supabase.auth.admin.getUserById(user.authUserId);
    console.log("Auth user from Supabase Admin:", authUser?.user?.id, authUser?.user?.email);
  }
}

main();
