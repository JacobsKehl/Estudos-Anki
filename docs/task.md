# Tarefas — Fases do Modo de Aceleração Adaptativo

## Status Atual do Projeto
- `[x]` **Fase 1 — Coleta de Tempo Real**: Concluída e Validada.
- `[x]` **Fase 2 — Continuar Estudando e Segunda Leitura**: Concluída e Validada.
- `[x]` **Correção Pós-Auditoria — Timer Manual**: Concluída e Validada.
- `[ ]` **Fase 3 — Ritmo Adaptativo / SpeedFactor**: **EM STANDBY** (Aguardando dados reais e autorização futura).

---

## Detalhes das Fases Concluídas

### Fase 1: Coleta de Tempo Real
- `[x]` Alterações de Schema Prisma (enums, campos e modelo StudySessionLog).
- `[x]` Validações físicas e clamping de 2x estimativa no backend.
- `[x]` Conclusão manual limpa sem contaminação de estatísticas.
- `[x]` Correção: Desativação do timer automático no carregamento de leitura e de segunda leitura.
- `[x]` Correção: Adicionados botões manuais de controle de tempo (Iniciar Leitura, Pausar, Retomar).
- `[x]` Correção: Confirmação ao concluir sem timer para não registrar tempo real falso.

### Fase 2: Continuar Estudando e Segunda Leitura
- `[x]` Endpoint de sugestões baseadas na hierarquia pedagógica (OVERDUE, SAME_SUBJECT, TODAY_CYCLE, NEXT_ELIGIBLE, SECOND_PASS).
- `[x]` Endpoint puro de log (`/api/study-session-log`) para segunda leitura sem mutações de SRS e progresso.
- `[x]` Layout visual customizado com banner de releitura e botão dinâmico para segunda leitura.

---

## Backlog Pendente — Fase 3: Ritmo Adaptativo (STANDBY ⏳)
- `[ ]` Calcular `speedFactor` dinâmico com base nos logs acumulados de `StudySessionLog`.
- `[ ]` Comparar tempos estimados versus tempos reais em relatórios dedicados.
- `[ ]` Estimar previsões adaptativas de conclusão de metas e prazos.
- `[ ]` Oferecer sugestões de compactação ou redistribuição de cronograma sob demanda.
