import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const GABRIELA_EMAIL = "gabriela.furtado.p@gmail.com";

async function main() {
  console.log("======================================================================");
  console.log("             ELO 1: VERIFICAÇÃO DE ESTADO EM AUTH.USERS               ");
  console.log("======================================================================\n");

  const rows: any[] = await prisma.$queryRawUnsafe(`
    select
      (encrypted_password is not null and encrypted_password <> '') as tem_senha,
      (email_confirmed_at is not null)                              as email_confirmado,
      (banned_until is null or banned_until < now())                as nao_banido,
      (deleted_at is null)                                          as nao_deletado,
      coalesce(raw_app_meta_data->>'provider', '?')                 as provider
    from auth.users
    where lower(email) = lower($1)
  `, GABRIELA_EMAIL);

  console.log("Saída literal da consulta no PostgreSQL:");
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
