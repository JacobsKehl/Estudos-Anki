# Walkthrough — Modo de Aceleração Adaptativo (Fases 1, 2 e Correções)

Este documento descreve as implementações concluídas e validadas do Modo de Aceleração Adaptativo e o status das fases de desenvolvimento.

---

## 📅 Fase 1: Coleta de Tempo Real (Concluída e Validada)

O objetivo desta fase foi estruturar e persistir dados reais sobre o tempo gasto pela aluna ao estudar cada bloco, preparando a base para ajustes de ritmo sem alterar regras pedagógicas, flashcards, ou prazos.

### 1. Alterações de Schema (Prisma)
- **Novos Enums**: `StudySessionActionType` (THEORY, SECOND_PASS, REINFORCEMENT, EXTRA_STUDY, etc.) e `StudySessionSource` (TIMER, MANUAL, SYSTEM).
- **Campos adicionados a `StudyScheduleItem`**: `startedAt`, `completedAt` e `actualDurationMinutes`.
- **Novo Modelo `StudySessionLog`**: Registro persistente para fins de telemetria e análise futura de ritmo.

### 2. Validações e Clamping
- Implementada proteção física (a duração real enviada via timer não pode exceder o tempo absoluto decorrido entre `startedAt` e `completedAt` + 1 minuto de tolerância).
- Implementada limitação de segurança (clamping a `2x estimatedMinutes` do bloco para evitar contaminação por timers esquecidos ligados).

---

## ⚡ Fase 2: Fluxo "Continuar Estudando" & Segunda Leitura (Concluída e Validada)

Esta fase implementou o fluxo opcional de continuidade de estudos para permitir que a Gabriela avance mais rápido quando concluir um bloco e possuir tempo ou disposição adicional.

### 1. Backend — Novos Endpoints
- **`GET /api/schedule/continue-suggestions`**: Retorna uma lista ordenada de sugestões de estudos com base na hierarquia pedagógica aprovada (`OVERDUE` -> `SAME_SUBJECT` -> `TODAY_CYCLE` -> `NEXT_ELIGIBLE` -> `SECOND_PASS`).
- **`POST /api/study-session-log`**: Endpoint seguro para registrar sessões de estudo de releitura (`SECOND_PASS`) sem alterar o cronograma ou o SRS. Cria apenas o log de telemetria (gravação pura).

### 2. Frontend — Tela de Resumo e Modo Releitura
- **Tela de Resumo (`BlockStudyView`, step `"summary"`)**: Nova seção com sugestões dinâmicas. Se concluído antes do tempo estimado, exibe a mensagem incentivadora sobre o saldo de tempo.
- **Modo Segunda Leitura (`secondPass=true`)**: Exibe banner visual informativo roxo. O botão final de ação é substituído por "Concluir Segunda Leitura" e redireciona a chamada para o log.

---

## 🛠️ Correção Pós-Auditoria: Timer Manual (Concluída e Validada)

Após a auditoria técnica, foram corrigidos dois pontos cruciais de comportamento de interface no frontend (`BlockStudyView.tsx`):

1. **Remoção de Autostart**: O cronômetro agora inicia 100% pausado (tanto no fluxo normal de estudos quanto na Segunda Leitura).
2. **Controles Manuais**: Adicionados os botões **"Iniciar Leitura"** (Play), **"Pausar"** (Pause) e **"Retomar"** (Play/Resume) na barra lateral.
3. **Registro de `startedAt` Real**: O timestamp inicial só é capturado no primeiro clique do usuário em "Iniciar Leitura".
4. **Prevenção de Tempo Falso**: Ao tentar concluir um bloco sem iniciar o cronômetro, uma tela de confirmação é exibida. Se confirmada, grava a conclusão como manual sem registrar tempo real artificial (`actualDurationMinutes: null`).

---

## ⏳ Fase 3: Ritmo Adaptativo / SpeedFactor (EM STANDBY)

A Fase 3 (Ritmo Adaptativo / SpeedFactor) está formalmente em **standby**.
- **O que NÃO foi alterado**: estimatedMinutes, data final do cronograma, metas diárias, carryover, flashcards, regras do spaced repetition (SRS), e lógica do backend.
- **Backlog Futuro**: Cálculo automático de `speedFactor`, comparação dinâmica de tempos estimado vs. real, simulação de nova previsão de término de ciclo e compactação adaptativa sob demanda.
- **Resolução de Retomada**: A ser reavaliado somente após acúmulo de dados reais suficientes e nova autorização do usuário.
