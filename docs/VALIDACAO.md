# Validação da versão inicial

Verificações realizadas em 11/10/2026, com dados sintéticos e PostgreSQL real:

- 11 testes de domínio: extração, identificação do advogado, IDs PROAD distintos, deduplicação, campos ausentes, classificação preliminar, vigência dos honorários, conversão, permissões e proteção de links.
- 4 testes de integração em banco exclusivo jda_test: aprovação concorrente, descarte sem tarefa, importação Notion idempotente/conflitos/fila autorizada e falhas sem vazamento do corpo de resposta. Requests ao Notion foram simulados; não foram acessadas contas reais.
- 4 testes de navegador: cadastro/honorários/aprovação/auditoria como Luciano; persistência em outra sessão e restrições de Rafael; tarefas/restrições de Gustavo e layout móvel; sessão obrigatória e saúde do PostgreSQL.
- TypeScript e build de produção aprovados. Reinstalação com npm ci, geração do cliente, reaplicação de migrações e seed sem sobrescrever registros existentes verificadas.
- Auditoria npm: zero vulnerabilidades reportadas, incluindo dependências de desenvolvimento. Isto não substitui revisão de segurança/homologação.
- Servidor de desenvolvimento: login, dashboard e conexão ao PostgreSQL verificados no navegador, sem erro JavaScript.
- Modo produção: o provider demo foi removido e o login não mostrou seleção de identidades demo. OAuth real Entra permanece não homologado, pois faltam tenant/credenciais/consentimento.
- Imagem Docker construída e iniciada como UID 1000: saúde PostgreSQL, login demo, dashboard e cliente persistente verificados. O build cloud precisou de proxy com hostname resolvido pelo host e CA de confiança montada somente durante instalação; TLS e integridade permaneceram habilitados.

Após limpeza dos registros próprios dos testes, a aplicação manteve 4 clientes, 3 usuários, 4 tarefas e 1 publicação sintéticos. O PostgreSQL e servidor de desenvolvimento ficam disponíveis na instância; o contêiner temporário de teste da imagem foi encerrado. Não houve publicação pública, sincronização real, escrita em registros externos ou cálculo de prazos processuais. A triagem é determinística por regras, sem envio a IA externa.

Os e-mails informados pelo usuário foram registrados na .env local ignorada e como variáveis não secretas do rascunho cloud. Os scripts de instalação/inicialização foram salvos no rascunho. Essa persistência não significa publicação ou restauração testada em uma nova tarefa.

Para produção: configurar os segredos com segurança, consentimento Microsoft, fontes e schemas Notion/planilha, executar os testes de homologação de docs/INTEGRACOES.md, revisar a fila antes de autorizar escrita e implantar conforme README.md.
