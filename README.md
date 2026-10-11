# JDA Gestão Integrada

Aplicação Next.js/TypeScript com PostgreSQL, login Microsoft Entra ID, permissões no servidor, auditoria e conectores configuráveis para Microsoft Graph e Notion. O ZIP original foi analisado como referência; seus dados processuais e links privados não fazem parte do seed.

## O que funciona

- Dashboard calculado do banco: clientes ativos, MRR contratual e evolução por vigência, pipeline/conversão, tarefas abertas/concluídas/atrasadas e distribuição.
- Busca de clientes, criação/edição e ficha com histórico, propostas, serviços/honorários, tarefas, processos e referências de documentos/atas.
- Controladoria persistente: distribuição por Luciano, atualização de tarefas pelos responsáveis, datas explicitamente conferidas.
- Triagem de publicações: extração conservadora, deduplicação, revisão obrigatória, aprovação transacional e fila de envio ao Notion.
- Conectores de leitura/escrita controlada, checkpoints, leases, retries, conflitos e auditoria.
- Demonstração com três perfis, dados sintéticos identificados e sem acesso/escrita externos.

Consulte [arquitetura](docs/ARQUITETURA.md) e [integrações](docs/INTEGRACOES.md). A triagem usa regras locais, não IA generativa. Não existe cálculo automático de prazo ou parecer definitivo. Os conectores estão implementados e testados com mocks; validação em contas reais depende de credenciais, schema e consentimento.

## Executar a demonstração

Requisitos: Node.js 24 LTS, npm, Docker/Compose. Use o checkout existente; cada tarefa cloud já é isolada e não precisa de worktree.

```bash
cd /workspace/Luciano # ou a pasta onde clonou este projeto
npm ci
node scripts/init-env.mjs
# O helper cria .env somente se ausente, com secret aleatório e credenciais LOCAIS demo.
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Abra a porta 3000 pelo mecanismo de acesso da sua hospedagem/desenvolvimento. A página de login oferece Luciano (ADMIN), Rafael (COMMERCIAL) e Gustavo (LEGAL) apenas no modo demonstração. Não exponha esse modo sem senha publicamente e não use dados reais nele. O banco persiste no volume Docker `jda_pg`; encerrar o processo web não perde os registros. `docker compose down` preserva o volume; `down -v` apaga o banco e não deve ser usado em dados de interesse.

A .env.example documenta todas as variáveis. .env é ignorada no Git. O helper não sobrescreve configuração existente. Credenciais locais de banco na demonstração são públicas/de desenvolvimento; gere outras para produção. O seed demo é idempotente e não reseta tarefas ou cadastros editados.

MRR representa honorários recorrentes contratados, não faturamento recebido. A curva usa contratos vigentes no fim de cada mês e no instante atual. Conversão = ganhas / (ganhas + perdidas). Datas de tarefas são manuais. Produção filtra os registros `isDemo`; recomendo banco separado e vazio para produção.

## Testar

```bash
npm test                  # regras, extração, deduplicação e permissões
npm run typecheck
npm run build
npm start                 # build otimizado, mantém modo definido na .env
# Em outro terminal, com servidor acima em execução:
npm run test:e2e
```

E2E requer APP_MODE=demo, seed e Chromium. A configuração usa /usr/bin/chromium se instalado; caso contrário instale o navegador com `npx playwright install chromium` preservando verificação de download. Nunca execute E2E em base real; os testes criam registros sintéticos e removem somente seus próprios registros.

Testes de transações/conectores usam banco separado `jda_test`:

```bash
docker compose exec -T db psql -U jda -d postgres -c 'CREATE DATABASE jda_test;'
# Defina TEST_DATABASE_URL para esse banco (com a senha local configurada).
TEST_DATABASE_URL=postgresql://jda:jda_local_only@localhost:5432/jda_test npm run test:db
```

A URL acima é EXCLUSIVAMENTE a credencial pública da demonstração. O runner exige nome jda_test e aplica as migrações antes dos testes. Os testes não fazem requests reais a Microsoft/Notion. `/api/health` retorna 200 somente se PostgreSQL responde e 503 se indisponível, sem expor detalhes.

## Banco e migrações

Prisma 6.19.3 usa `engineType=client` e adapter-pg, sem query engine nativo. `npm run db:generate` usa o gerador JavaScript do pacote Prisma fixado, evitando downloads de binários sem desativar verificações. O script é acoplado à versão fixada de @prisma/internals; valide geração e testes ao atualizar Prisma. Não edite arquivos em node_modules.

`npm run db:migrate` aplica SQL versionado em prisma/migrations, transacionalmente, com advisory lock e checksum registrado em `_jda_migrations`. Não usamos `prisma migrate deploy`; não misture os dois sistemas de rastreamento. Nunca altere migração aplicada: adicione uma pasta versionada, SQL revisado e atualize schema.prisma. Novos campos e mudanças devem ter validação de compatibilidade e recuperação. Role de migração pode criar schema; role da aplicação deve ter somente permissões necessárias. Auditoria é persistente e sem endpoint de edição, mas não um arquivo inviolável contra administrador do banco.

## Publicar

1. Provisione PostgreSQL privado, TLS verificado e backups com recuperação testada; use banco próprio de produção. Não publique a porta do banco.
2. Configure APP_MODE=production, DEMO_LOGIN_ENABLED=false, NEXTAUTH_URL=https://SEU-DOMINIO e NEXTAUTH_SECRET aleatório. Configure a allowlist e Entra ID conforme docs/INTEGRACOES.md, no gerenciador de segredos.
3. Instale com npm ci, gere cliente, aplique migrações, execute seed no modo produção (somente identidades). Execute testes e build. Configure variáveis também no ambiente de execução. Não copie .env demo.
4. Hospede em serviço Node compatível com Next.js (ou imagem Docker abaixo), com HTTPS, acesso restrito e reinício automático; execute npm start. Separe o processo de sincronização do servidor web e agende conforme as fontes autorizadas.
5. Homologue login/RBAC, schemas e leitura nas fontes. Escrita externa permanece desativada até autorização; revise a fila antes de habilitar. Teste em um banco Notion de homologação antes do real.
6. Monitore `/api/health`, SyncState, Outbox e auditoria; defina retenção de e-mails/metadados/logs, backup, alertas e resposta a incidentes. Controle acesso no Entra e no banco. Ao ampliar usuários, implemente atribuição por cliente e revise a política de acesso.

```bash
docker build -t jda-gestao .
# Configure segredos e DATABASE_URL da hospedagem antes de executar:
docker run --rm --env-file .env.production jda-gestao npm run db:migrate
docker run --rm --env-file .env.production jda-gestao npm run db:seed
docker run --env-file .env.production -p 3000:3000 jda-gestao
# Worker/cron separado:
docker run --rm --env-file .env.production jda-gestao npm run sync
```

O Dockerfile mantém dependências de desenvolvimento para ferramentas de geração/migração; é uma imagem funcional inicial, não otimizada para tamanho. Banco dentro do Docker Compose é para desenvolvimento; produção deve usar configuração dedicada. Não foi realizado deploy público nem homologação de OAuth/Graph/Notion real. A interface não publica documentos confidenciais; links externos continuam exigindo permissão na origem.

Em ambientes cloud com proxy e CA privada, use os argumentos de proxy e monte a CA pública de confiança apenas no build (o Dockerfile aceita esse secret de build opcional):

```bash
# Se o BuildKit não resolver o proxy, use o IP resolvido pelo próprio ambiente.
JDA_PROXY_HOST=$(node -e 'process.stdout.write(new URL(process.env.HTTPS_PROXY).hostname)')
JDA_PROXY_IP=$(getent ahostsv4 "$JDA_PROXY_HOST" | awk 'NR==1 {print $1}')
DOCKER_CONFIG=/tmp/jda-docker docker build --network host \
  --add-host "$JDA_PROXY_HOST:$JDA_PROXY_IP" \
  --build-arg HTTP_PROXY --build-arg HTTPS_PROXY --build-arg NO_PROXY \
  --secret id=platform_ca,src="$NODE_EXTRA_CA_CERTS" -t jda-gestao .
```

Esse comando usa a CA já fornecida pelo ambiente. Não inclui chaves privadas ou segredos da aplicação e não desabilita TLS. Em hospedagens sem esse proxy, o build comum é suficiente.
