import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const DEDICATED_EMAIL = "smoke-tester@estudosanki.internal";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const password = process.env.SMOKE_PASSWORD || "SmokeTester123!";

  console.log(`Checking if ${DEDICATED_EMAIL} exists in Supabase Auth...`);
  
  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    process.exit(1);
  }

  let smokeAuthUser = authUsers.users.find(u => u.email === DEDICATED_EMAIL);

  if (!smokeAuthUser) {
    console.log(`Creating new Auth user for ${DEDICATED_EMAIL}...`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: DEDICATED_EMAIL,
      password: password,
      email_confirm: true
    });

    if (createError || !newUser.user) {
      console.error("Error creating Auth user:", createError);
      process.exit(1);
    }
    smokeAuthUser = newUser.user;
    console.log(`Auth user created with ID: ${smokeAuthUser.id}`);
  } else {
    console.log(`Auth user already exists with ID: ${smokeAuthUser.id}`);
  }

  const { data: existingDbUser } = await supabase
    .from("User")
    .select("*")
    .eq("authUserId", smokeAuthUser.id)
    .maybeSingle();

  if (!existingDbUser) {
    console.log("Creating public User record...");
    const { error: insertError } = await supabase.from("User").insert({
      id: smokeAuthUser.id,
      authUserId: smokeAuthUser.id,
      email: DEDICATED_EMAIL,
      name: "Smoke Tester Dedicated",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (insertError) {
      console.error("Error inserting public User record:", insertError);
    } else {
      console.log("Public User record created successfully!");
    }
  } else {
    console.log("Public User record already exists.");
  }
}

main();
