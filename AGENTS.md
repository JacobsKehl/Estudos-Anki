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

