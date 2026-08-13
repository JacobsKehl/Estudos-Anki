# Runbook de Rollback e Segurança Operacional

> [!CAUTION]
> **Aviso de Privacidade e Versionamento**
> - Os arquivos de dump binário (`backups/*.dump`) contêm dados de estudo reais da usuária (incluindo materiais e notas de estudo) e **NUNCA** devem ser commitados no Git. Eles estão ignorados no `.gitignore`.
> - Os arquivos JSON em `docs/checkpoints/<rotulo>.json` contêm exclusivamente métricas agregadas e IDs anônimos de matérias. Eles são o **registro de verdade oficial** do sistema e são versionados no Git junto às tags.

---

## 1. Listar Checkpoints Disponíveis

Para ver o histórico de checkpoints disponíveis:

```bash
# Listar tags de versionamento de código no Git
git tag -l -n1

# Listar registros de distribuição de dados no repositório
ls docs/checkpoints/

# Listar dumps locais de banco disponíveis
ls backups/*.dump
```

---

## 2. Ordem de Restauração (CRÍTICO)

A ordem de restauração **DEVE** ser:

1. **Primeiro o Banco de Dados**: Restaurar os dados a partir do arquivo `.dump` usando o script `restore.ts`.
2. **Segundo o Código (Git)**: Fazer checkout da tag Git correspondente (`git checkout <rotulo>`).

> **Por que a ordem importa?**
> Código novo executado contra um banco antigo sem migração pode corromper tabelas ou estourar exceções de schema. Código antigo executado contra banco antigo garante compatibilidade 100% determinística.

---

## 3. Procedimento de Restauração Passo a Passo

### Passo A — Restaurar o Banco de Dados

Para restaurar em um banco descartável (Docker ou projeto de teste):

```bash
npx tsx scripts/restore.ts backups/cp1-hybrid-removed-<timestamp>.dump --target-url postgresql://usuario:senha@localhost:5432/meubanco_teste
```

Se por um motivo emergencial for necessário restaurar no banco de produção:

```bash
npx tsx scripts/restore.ts backups/cp1-hybrid-removed-<timestamp>.dump --target-url "$DIRECT_URL" --target-is-production
```

O script exigirá a confirmação textual digitando `RESTAURAR` no terminal.

### Passo B — Fazer Checkout da Tag Git

```bash
git checkout cp1-hybrid-removed
```

### Passo C — Validar Integridade com o Comando `--compare`

Colete a distribuição do banco restaurado e compare com o JSON de referência:

```bash
# 1. Coletar distribuição do banco restaurado
npx tsx scripts/checkpoint.ts cp1-restored-verification

# 2. Comparar com a referência versionada no Git
npx tsx scripts/checkpoint.ts --compare docs/checkpoints/cp1-hybrid-removed.json docs/checkpoints/cp1-restored-verification.json
```

A comparação deve retornar **NENHUMA REGRESSÃO CRÍTICA** (0 flashcards órfãos, contagem idêntica de blocos com `theoryStatus = COMPLETED`).

---

## 4. Preservação Seletiva de Histórico (Rollback Parcial)

Caso um problema seja detectado tardiamente após o usuário ter realizado revisões de flashcard ou sessões de estudo:

- As tabelas de histórico **`FlashcardReview`** e **`StudySessionLog`** registradas no período intermediário devem ser preservadas.
- Estruturas de blocos, cronogramas e materiais podem ser restauradas.

---

## 5. Cobertura do Backup

- O backup via `checkpoint.ts` cobre estritamente o schema `public` do PostgreSQL (dados de matérias, blocos, flashcards, cronogramas e históricos).
- O backup **NÃO** inclui os schemas `auth` e `storage` do Supabase. Os usuários do sistema não são afetados pelas operações de dump/restore de estudo.
