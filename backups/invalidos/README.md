# Dumps Inválidos Quarentenados (0 Bytes)

Os arquivos nesta pasta foram gerados entre H1 e H2b pelo script `checkpoint.ts`.
Eles possuem **0 bytes de tamanho** porque o comando de dump (`pg_dump` / `npx supabase db dump`) falhou por falta de binários do PostgreSQL ou timeout de conexão socket IPv6/IPv4, e o script antigo perdoava o erro em um bloco `try/catch` silencioso.

## Importante:
- Os **dados reais da usuária continuam preservados no banco de dados de produção do Supabase**.
- Os arquivos de métricas **JSON** em `docs/checkpoints/` continuam **100% VÁLIDOS** porque foram coletados via Prisma Client diretamente do banco, não pelo `pg_dump`.
- Estes arquivos de 0 bytes foram renomeados para `.invalid` e mantidos aqui como histórico e evidência de auditoria.
