<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras de Segurança Operacional para Scripts

Para evitar exclusões ou alterações acidentais de dados em produção, as seguintes regras operacionais são obrigatórias:

1. **Read-only por padrão**: Scripts de auditoria, análise e simulação devem realizar apenas consultas (`find`, `count`, etc.) e nunca mutações de dados por padrão.
2. **Flag explícita**: Qualquer operação destrutiva (`deleteMany`, `updateMany`, etc.) ou de alteração de estado no banco de dados deve exigir uma flag de linha de comando explícita (ex: `--apply` ou `--execute`).
3. **Confirmação textual**: Scripts com potencial destrutivo executados manualmente devem solicitar uma confirmação textual explícita via terminal (ex: digitar "SIM" ou o e-mail do usuário afetado) antes de prosseguir com alterações.
4. **Bloqueio em Produção**: Scripts perigosos devem validar as variáveis de ambiente (`NODE_ENV === 'production'` ou conexões de produção na `DATABASE_URL`) e bloquear a execução automática a menos que flags de bypass específicas sejam fornecidas.
5. **Rollback Garantido em Simulações**: Scripts de simulação (`dry-run`) executados dentro de transações de banco de dados devem garantir o rollback lançando explicitamente um erro controlado ao final do bloco de transação (`throw new Error('ROLLBACK_CONTROLLED')`). Nunca assumir que a transação não será gravada se o script terminar sem falha.
6. **Snapshot/Contagem**: Antes de executar qualquer exclusão em lote (`deleteMany`) ou alteração estrutural relevante em produção, o script deve registrar uma contagem/snapshot prévia no log.
7. **Limpeza pós-execução**: Após a execução de scripts temporários de diagnóstico ou restauração emergencial, o status do git deve ser validado e os arquivos temporários devem ser removidos do diretório de trabalho.

# Regras do projeto — Kehl Study

## 0. O contexto em três linhas

Aplicação de estudo para **uma aluna** (Gabriela, `userId cmp8od0wz0000iybklaotfqbs`), concurso
**TRT4**, banca FCC. O acervo de teoria são **5 PDFs do CFC**. Um erro aqui não é um bug: é um dia de
estudo perdido às vésperas de uma prova.

---

## 1. O blueprint é a fonte de verdade — e ele NÃO sai do banco

```
tmp/BLUEPRINT-blocos-cfc.csv    94 linhas · 366 páginas · 1098 minutos · maior bloco 8 páginas
md5: d321b5db06c4c1ef101fd80099dfe2e2
```

Ele foi extraído do **sumário dos 5 PDFs**, conferido 75 de 75 capítulos. **O banco é o que se
compara contra ele.**

> 🔴 **NUNCA gere esse CSV a partir do banco.** Já aconteceu: o guardião passou a comparar o banco
> com um arquivo derivado do próprio banco, e passava sempre. **Se o arquivo faltar, peça — não
> reconstrua.**

⚠️ **O arquivo é gitignored e já se perdeu uma vez.** Se ainda não estiver versionado:
`git add -f tmp/BLUEPRINT-blocos-cfc.csv` — ele não tem dado pessoal, só título de capítulo e página.

## 2. O guardião

```bash
node scripts/run-guard-test.js     # → tem que dar 8/8
```

Roda `src/__tests__/cfc/block-blueprint-integrity.test.ts` com `RUN_CFC_BLUEPRINT_DB_TEST=true`.
**Rode antes e depois de qualquer mudança no agendador ou no acervo.**

## 3. Regra Zero — teste que nunca foi visto reprovando não conta

**Todo teste novo roda ANTES do conserto e tem que FALHAR**, apontando o defeito real. Cole as duas
saídas: a vermelha e a verde.

🔴 **E teste não pode conferir a si mesmo.** Já aconteceu três vezes:
- um simulador que reimplementava as regras do agendador *(passou com tudo zerado enquanto 7 dias
  estavam quebrados)*
- um teste de UI que redefinia o filtro dentro do próprio arquivo
- o guardião com o CSV gerado do banco

**Se o teste não importa o código de produção, ele não testa o código de produção.**

## 4. Nada de DELETE

**`EXCLUDED` para bloco, `SKIPPED` para item de agenda.** São reversíveis; `DELETE` não é.
Já custou 136 linhas apagadas por um script de reorganização.

**Exceção:** rotas de CRUD que o usuário aciona conscientemente (apagar um PDF, um flashcard).
**Essas exigem backup antes.**

## 5. Backup antes de qualquer escrita

- rótulo **novo** a cada vez, nunca reaproveitado
- **paginado**, com **asserção de contagem por tabela** que **aborta**
- arquivo que falhou na asserção **não fica com nome de backup** *(por isso existe um
  `pre-limpeza-agenda.TRUNCADO.json` na pasta — é a regra funcionando)*
- **backup e escrita nunca no mesmo script**
- `--dry-run` antes de `--apply`, com os números impressos, e **parada** esperando aprovação

## 6. Um commit por conserto

Nada de dois consertos no mesmo commit. **Já se perdeu a capacidade de reverter** porque uma correção
de uma linha subiu junto com quatro telas.

## 7. Nunca edite um teste para ele passar

Se um teste falhou depois da sua mudança, **a suspeita é do código**. Se mesmo assim o teste precisar
mudar, **mostre o diff** e explique por quê. *(Ajustar fixture para satisfazer uma regra nova é
legítimo. Afrouxar asserção não é.)*

## 8. Toda contagem vem com o `where` ao lado

`StudyBlock: 597` não significa nada. `StudyBlock global: 597 · da Gabriela: 537` significa.
**Três rodadas de confusão nasceram de contagens sem escopo.**

---

## 9. Os caminhos que escrevem no banco — o mapa completo

| gatilho | o que faz | atenção |
|---|---|---|
| **cron `*/15`** → `/api/cron/reminder` | só age na janela **08:00–08:20** (`emailReminderTime`); chama `reorganizeActiveSchedule` → `reorganizeOverdueSchedule` | **dispara e-mail para a aluna** — não chame essa rota em teste |
| **abrir a home** `src/app/page.tsx:192` | `shouldReorganizeSchedule` → `reorganizeOverdueSchedule` no **primeiro acesso do dia** | **é um `GET` que grava.** Dívida registrada: tirar a escrita da renderização |
| `/api/materials/organize-all` `{reset:true}` | apaga flashcards, revisões, blocos, cronograma e planos — e reconstrói **por IA** | **a proteção ao CFC cobre `StudyBlock` e `StudyMaterial` apenas.** `Flashcard`, `FlashcardReview` e `StudySchedule` são apagados do usuário inteiro, CFC incluído: o filtro `notIn: cfcFileList` em `studyScheduleItem` (`route.ts:603`) é anulado pelo cascade de `studySchedule.deleteMany` na instrução seguinte (`schema.prisma:397`, `onDelete: Cascade`). Cartões e histórico de revisão **não voltam** — a reorganização por IA só reprocessa material não-CFC. O caminho de clique foi removido da interface em 17/09/2026 (era `SettingsForm.tsx`, "Reorganizar tudo do zero"). A rota só deve ser acionada por script, com `--apply` e confirmação textual |
| `completeStudyBlock` | marca `COMPLETED` e cria `REVIEW_BLOCK` D+1 | |
| **push na branch de produção** | deploy + `prisma migrate deploy` **no banco de produção** | **push É publicação.** Production Branch = `release`; push em `main` é só preview. Ver §12 |

🔴 **Filtro de proteção precisa ser provado, não lido.** Um `where` que exclui dados sensíveis não
protege nada se uma instrução seguinte apaga o pai por cascade. Antes de confiar numa
salvaguarda, verifique o `onDelete` das relações envolvidas — já houve um filtro de CFC anulado
por cascade uma linha depois.

## 10. O predicado, nas quatro consultas

```ts
theoryStatus: "NOT_STARTED"                        // lista branca, sempre
&& CFC_FILE_NAMES.includes(material?.originalFileName)
```

🔴 **Nunca `{ not: "COMPLETED" }`.** Foi assim que blocos `EXCLUDED` voltaram para a agenda dela —
**quatro vezes, em quatro lugares diferentes.** Lista negra deixa passar todo status futuro.

**As constantes vivem em `src/lib/scheduler/config.ts`:** `ORDEM_MATERIAS`, `CFC_FILE_NAMES`,
`SCHEDULER_LIMITS`. **Literal repetido em duas consultas é como as duas divergem.**

## 11. As regras do agendador

```
R1  dentro da matéria, sempre em ordem de pageStart
R2  cota de TEORIA = 45 min/dia (piso 30, teto 60)
    ⚠️ dailyGoalMinutes = 120 é o TOTAL do dia (teoria + exercícios + flashcards). NÃO é a cota de teoria
R3  nunca duas da mesma matéria no dia, havendo outra disponível
    (esgotadas as outras, a R3 se suspende e a cota de minutos manda)
R4  o primeiro bloco do dia ≠ a matéria que abriu o dia anterior
R5  DOMINGO: zero teoria. Revisões e SRS continuam
    🔴 NÃO tire o domingo de studyDaysOfWeek — domingo é o weeklyReviewDayOfWeek.
       A R5 mora no agendador, não na preferência
R6  dia não estudado: o atrasado consome a cota primeiro, sem somar com o novo
R9  bloco EXCLUDED nunca entra no pool
```

**Idempotência:** rodar `reorganizeOverdueSchedule` duas vezes seguidas tem que produzir **zero**
mudanças. *(Já produziu 46. A causa era gravar sem comparar com o estado atual.)*

**A simulação de 30 dias chama a função real** — molde `scripts/test-reorganize-with-backup-b.ts`.
**Nada de simulador próprio.**

---

## 12. Publicar

🔴 **"`git push` não publica" é FALSO — sempre foi.** O painel mostra `JacobsKehl/Estudos-Anki`
conectado desde 16 de maio. Rodou errado a sessão inteira até um incidente real (produção fora do
ar por ~53 min, `@swc/helpers` excluído do bundle) expor isso.

**Production Branch = `release`.** Push nela publica de verdade — build, deploy, e
`prisma migrate deploy` no banco de produção, sem perguntar. Push em `main` (ou em qualquer outra
branch) só gera preview.

**O fluxo:**
```
1. branch nova a partir de release          git checkout release && git checkout -b fix/algo
2. commit do conserto (um só, regra 6)
3. push da branch                            → gera PREVIEW, não produção
4. verificar o preview antes de prosseguir:
     - GET / e GET /login → 200, título certo
     - pelo menos uma rota que só o app poderia responder (ex: POST /api/auth/login
       com credencial falsa → 400/401 do app, não 500 de módulo)
     - `npx vercel logs <url-preview>` → confirma que as invocações aconteceram e
       que não há erro de módulo/import
   (proteção SSO do preview bloqueia curl direto — use `npx vercel curl <url> -- <args>`,
   autenticado pela sessão da CLI, não por login no navegador)
5. só depois do preview validado: merge em release e push        → ESSE push publica
6. depois de publicado: merge de volta em main, para a próxima branch não nascer quebrada
```

**`npx vercel --prod`** continua existindo como comando manual, mas não é mais o caminho normal de
publicar — ele ignora o preview e vai direto pra produção. Reserve para quando `release` não puder
ser usada.

🔴 **`outputFileTracingExcludes` remove arquivos do bundle serverless — já derrubou a produção duas
vezes** (`@prisma/engines` em setembro, `@swc/helpers` em 16/09, 53 min fora do ar). Um pacote só
entra nessa lista depois de responder por escrito: **ele é usado em RUNTIME?** Se a resposta não for
um "não" verificado (grep em `src/`, não achismo), ele fica de fora. **Escopo inteiro (`@org/**`)
nunca** — só o subpacote exato que de fato é build-time.

🔴 **Verificação de deploy não é status 200 numa página estática.** A página de login serve do CDN e
devolveu 200 com título correto **durante a queda inteira de 16/09** — enganou duas verificações
independentes antes de alguém pedir a rota certa. **Precisa ser uma resposta que SÓ o código da
aplicação poderia ter gerado**: um 400/401 com corpo JSON do app, um stack trace passando por código
de negócio (não por `next/dist/...`). Ver o passo 4 do fluxo acima — é o motivo dele existir.

**Variáveis na Vercel:**
```
DATABASE_URL  →  pooler  :6543  +  ?pgbouncer=true    (serverless; sem isso dá erro intermitente
                                                       de prepared statement)
DIRECT_URL    →  direta  :5432                        (migrações)
```
**No `.env` local as duas podem ser a direta** — rede diferente, padrão de conexão diferente.

## 13. Segredos

**Nome sim, valor nunca.** Nem em log, relatório, commit, exemplo ou máscara.
**`SUPABASE_SERVICE_ROLE_KEY` nunca leva prefixo `NEXT_PUBLIC_`.**
Scripts temporários com credencial literal são apagados ao fim da sessão.

## 14. Riscos aceitos — **não reabrir, não sugerir de novo**

```
repositório público
senha, e-mail e CPF da aluna em scripts/diag/
chave sb_secret_ e senha do banco expostas em conversa
/api/cron/reminder autorizando por x-vercel-cron sozinho
```

**São decisões do dono do projeto, tomadas com os fatos na mão.** Registre se for relevante ao que
está fazendo; **não proponha rotação nem correção.**

