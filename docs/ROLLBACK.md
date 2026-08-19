# Runbook de Rollback e Segurança Operacional

> [!CAUTION]
> **Aviso de Privacidade e Versionamento**
> - Os arquivos de backup JSON (`backups/json/`) contêm dados de estudo reais da usuária e **NUNCA** devem ser commitados no Git. Eles estão protegidos no `.gitignore`.
> - Os arquivos de manifesto em `docs/backups/<rotulo>-manifest.json` contêm exclusivamente métricas agregadas, hashes SHA-256 e IDs anônimos. Eles são o **registro de verdade oficial** do sistema e são versionados no Git.

---

## 1. Conectividade e Formas de Conexão (Supabase)

| Forma | Host | Porta | Rede | `pg_restore` / PostgREST | Uso Recomendado |
|---|---|---:|---|---|---|
| **Direta** | `db.<ref>.supabase.co` | 5432 | **Apenas IPv6 (AAAA)** | ✅ Suporta | Ambientes com suporte nativo IPv6 |
| **Session Pooler** | `aws-…pooler.supabase.com` | **5432** | IPv4 (A) | ✅ Suporta | Recomendado para Restauração / Migração em IPv4 |
| **Transaction Pooler** | `aws-…pooler.supabase.com` | **6543** | IPv4 (A) | ❌ Incompatível | Apenas para queries curtas da aplicação (Prisma) |
| **HTTPS PostgREST** | `<ref>.supabase.co` | **443** | **IPv4 & IPv6** | ✅ Suporta (REST Engine) | **Recomendado para Ambientes sem Acesso a Portas TCP 5432/6543** |

---

## 2. Trava de Segurança por Project Ref

Os scripts de restauração (`scripts/restore-from-json.ts` e `scripts/restore-production.ts`) implementam trava automática por **Project Ref**:
- Extraem o ref de produção (`msmdekjetxajcwuxmxps`).
- Se a URL de destino apontar para a produção, o script de restauração genérico **ABORTA imediatamente por padrão**.

---

## 3. Procedimento de Restauração em Produção (`scripts/restore-production.ts`)

Caso ocorra um incidente grave durante a execução do F1 e seja necessário restaurar a produção para o estado pré-incidente:

### Condições Obrigatórias e Inegociáveis:
1. **Flag Explícita de Linha de Comando:** `--i-am-restoring-production`
2. **Variável de Ambiente Confirmada:** `PRODUCTION_RESTORE_CONFIRMED=true`
3. **Pre-Snapshot Automático:** O script tira um backup completo do estado atual (pós-incidente) antes de apagar qualquer linha, salvando em `backups/json/pre-restore-snapshot-<timestamp>/`.
4. **Verificação de Hash SHA-256:** O manifesto do backup de origem (`docs/backups/<rotulo>-manifest.json`) deve ter seus hashes SHA-256 validados em 100% das tabelas antes da primeira escrita.

### Comando Exato:
```bash
PRODUCTION_RESTORE_CONFIRMED=true npx tsx scripts/restore-production.ts cp2b-rest --i-am-restoring-production
```

---

## 4. Análise de Estratégia de Restauração e Contraindicações

### Estratégia Escolhida: Limpeza Transacional com Pre-Snapshot
Limpamos todas as tabelas em ordem estrita de FK e reinserimos do zero os dados do backup. Essa abordagem elimina duplicatas e sujeira criadas pelo incidente. O risco de perda é mitigado 100% pelo **Pre-Snapshot automático obrigatório**.

### 🛑 CONTRAINDICAÇÕES (Quando NÃO Usar o Rollback em Produção):
- **NÃO use** se o problema for apenas um erro de cálculo de UI ou front-end (corrija no código).
- **NÃO use** se tiverem se passado dias e a usuária tiver gerado novo histórico de estudos válido que seria perdido (nesse caso, use restauração cirúrgica por tabela).
- **NÃO use** sem antes validar a integridade SHA-256 do manifesto de origem.

---

## 5. FK `StudyBlock.officialTopicId → SyllabusTopic.id` — Regra de Deleção

> [!CAUTION]
> **NUNCA apague linhas de `SyllabusVersion` ou `SyllabusTopic`.**

A FK foi criada com `ON DELETE SET NULL`. Isso significa que apagar um `SyllabusTopic` **não** gera erro — o Postgres silenciosamente seta `officialTopicId = NULL` em todos os `StudyBlock` que apontavam para aquele tópico. O mapeamento bloco→tópico se perde sem aviso.

**Regra operacional:**
- Versão de taxonomia sai de circulação com `isActive = false`, **nunca** com `DELETE`.
- Tópicos individuais **nunca** são deletados. Se um tópico mudar de nome ou escopo numa nova versão do edital, cria-se uma nova `SyllabusVersion` com os tópicos corrigidos.
- Qualquer script que execute `DELETE FROM "SyllabusTopic"` ou `DELETE FROM "SyllabusVersion"` em produção é um incidente.

---

## 6. Pendência Bloqueante do F1: `backup-via-rest.ts`

> [!WARNING]
> O script `scripts/backup-via-rest.ts` **está quebrado** e não consegue gerar backups por HTTPS.

Sem ele, backup só é possível com TCP na porta 5432 liberada — o que depende de janelas de conectividade imprevisíveis. **O F1 não deve rodar sem um mecanismo de backup funcional**, pois o pre-snapshot obrigatório do `restore-production.ts` depende de conseguir extrair dados antes de qualquer escrita.

**Ação necessária antes do F1:** corrigir o `backup-via-rest.ts` ou implementar alternativa equivalente por HTTPS/PostgREST.

---

## 7. Scripts de Verificação Disponíveis

| Script | Propósito |
|---|---|
| `scripts/check-migration-state.ts` | Verifica estado de todas as migrations no banco |
| `scripts/apply-official-topic-fk.ts` | Aplica FK officialTopicId (dry-run por padrão) |
| `scripts/check-orphan-official-topics.ts` | Audita órfãos na FK officialTopicId |
| `scripts/verify-gabriela-subjects.ts` | Confirma contagens 348/132/862 |
| `scripts/check-not-null-prod.ts` | Verifica constraints NOT NULL no banco |

---

## 8. Proteção contra o Índice Único Parcial `SyllabusVersion_single_active`

> [!CAUTION]
> **NUNCA aplique o DDL `CREATE UNIQUE INDEX "SyllabusVersion_single_active" ON "SyllabusVersion"("isActive")` gerado por `npx prisma migrate diff`.**

### Motivo Físico:
No PostgreSQL, o índice foi criado via SQL bruto na migration `150003_create_syllabus_tables` como um **ÍNDICE ÚNICO PARCIAL**:
```sql
CREATE UNIQUE INDEX "SyllabusVersion_single_active" 
ON public."SyllabusVersion" USING btree ("isActive") 
WHERE ("isActive" = true);
```
Ele garante que **no máximo UMA** versão de taxonomia pode ter `isActive = true`. Múltiplas versões inativas (`isActive = false`) são permitidas.

O Prisma CLI não representa a cláusula `WHERE` de índices parciais no `schema.prisma`. Por isso, o `prisma migrate diff` sugere erroneamente recriá-lo como um índice único TOTAL. Se esse DDL for aplicado, o banco travará e rejeitará qualquer inserção de uma segunda versão inativa (`false`).

**Regra operacional:**
Scripts de geração de migration (`scripts/diag/run_prisma_migrate_diff.ts` ou equivalentes) devem abortar automaticamente se detectarem `SyllabusVersion_single_active` na saída do DDL.

---

## 9. Proteção e Limites de Plano da Vercel (Hobby vs. Pro)

> [!CAUTION]
> **Mudança de plano na Vercel é mudança de ambiente de build.**

- **Vercel Crons no Hobby Plan:** Contas Hobby aceitam no máximo **uma execução de cron por dia** (`0 8 * * *`). Agendamentos com expressões cron frequentes (ex: `*/15 * * * *`) fazem a Vercel rejeitar o pré-flight do deploy **silenciosamente no nível de infraestrutura**, sem gerar entradas no log de compilação.
- **Duração de Functions (`maxDuration`):** O valor padrão e máximo no Hobby é 60s; no Pro é 300s (podendo ir a 800s).
- **Guarda-costas de Deploy:** O script `scripts/diag/verify-prod-positive-control.ts` deve ser executado pós-deploy para verificar se o `Deployment ID` realmente mudou e interromper com exit code não-nulo caso a produção continue estagnada.


