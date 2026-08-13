# Runbook de Rollback e Segurança Operacional

> [!CAUTION]
> **Aviso de Privacidade e Versionamento**
> - Os arquivos de dump binário (`backups/*.dump`) contêm dados de estudo reais da usuária (incluindo materiais e notas de estudo) e **NUNCA** devem ser commitados no Git. Eles estão ignorados no `.gitignore`.
> - Os arquivos JSON em `docs/checkpoints/<rotulo>.json` contêm exclusivamente métricas agregadas e IDs anônimos de matérias. Eles são o **registro de verdade oficial** do sistema e são versionados no Git junto às tags.

---

## 1. Conectividade e Formas de Conexão (Supabase)

| Forma | Host | Porta | Rede | `pg_restore` | Uso Recomendado |
|---|---|---:|---|---|---|
| **Direta** | `db.<ref>.supabase.co` | 5432 | **Apenas IPv6 (AAAA)** | ✅ Suporta | Ambientes com suporte nativo IPv6 |
| **Session Pooler** | `aws-…pooler.supabase.com` | **5432** | IPv4 (A) | ✅ Suporta | **Recomendado para Restauração / Migração em IPv4** |
| **Transaction Pooler** | `aws-…pooler.supabase.com` | **6543** | IPv4 (A) | ❌ Incompatível | Apenas para queries curtas da aplicação (Prisma) |

> ⚠️ **NUNCA use a porta 6543 (Transaction Pooler) para `pg_restore` ou `prisma migrate`**. O modo transação não fornece persistência de sessão e causa falha de intspecção/DDL.

---

## 2. Trava de Segurança por Project Ref

O script `scripts/restore.ts` implementa trava automática por **Project Ref**:
- **Conexão Direta:** Extrai o ref do host (`db.<ref>.supabase.co`).
- **Connection Pooler:** Extrai o ref do usuário (`postgres.<ref>`).

Se o ref extraído da variável de destino for idêntico ao ref de produção (`DATABASE_URL`/`DIRECT_URL`), a restauração é **ABORTADA imediatamente**, exigindo a flag explícita `--target-is-production` e confirmação textual por extenso. Se o ref não puder ser extraído de alguma URL, a restauração é abortada por padrão.

---

## 3. Ordem de Execução do Rollback

1. **Restaurar Banco de Dados**: Executar `pg_restore` contra o projeto de destino via **Session Pooler (porta 5432)**.
2. **Git Checkout**: Fazer checkout do código na tag correspondente (`git checkout <tag>`).
3. **Validação por Distribuição (`--compare`)**: Coletar métricas do banco restaurado e comparar contra o JSON oficial do checkpoint.

---

## 4. Comando Exato de Restauração (`pg_restore`)

```bash
# 1. Restauração em banco descartável/teste:
npx tsx scripts/restore.ts backups/cp2b-escopo-peso2-2026-08-13T02-56-04-249Z.dump --target-env TEST_TARGET_URL

# Comando pg_restore executado internamente (Flags oficiais):
pg_restore --schema=public --clean --if-exists --no-owner --no-privileges -d "<URL_SESSION_POOLER_5432>" "<ARQUIVO.dump>"
```

---

## 5. Validação com `--compare`

```bash
# Coletar o estado do banco restaurado
npx tsx scripts/checkpoint.ts cp2b-restored-verification

# Comparar exatamente com o JSON oficial versionado no Git
npx tsx scripts/checkpoint.ts --compare docs/checkpoints/cp2b-escopo-peso2.json docs/checkpoints/cp2b-restored-verification.json
```

O teste é considerado aprovado quando as contagens de `StudyBlock`, `Flashcard`, `FlashcardReview` e `StudySessionLog` baterem **100% sem nenhuma regressão de blocos concluídos ou cartões órfãos**.
