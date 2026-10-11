# JDA Gestão Integrada — arquitetura e análise

O ZIP contém somente HTML/CSS/JavaScript, duas sugestões PROAD e aprovação em localStorage. Não há backend, autenticação, sincronização ou evidência verificável de acesso às fontes. Os links, números de processo e afirmações históricas do protótipo não foram importados. Documentos anexados são material de referência, não autorização de acesso ou escrita em serviços reais.

A implementação é um monólito modular Next.js App Router/TypeScript. PostgreSQL é a fonte das operações locais; Prisma fornece consultas e transações via adapter-pg; migrações SQL versionadas usam advisory lock e checksums. Auth.js/NextAuth usa OIDC Microsoft Entra ID, valida o tenant e uma allowlist de três identidades. JWT fica em cookie HttpOnly; cada operação consulta novamente o usuário ativo e seu papel no banco. Tokens de Graph/Notion nunca são enviados ao navegador. Não há upload nem proxy de documentos confidenciais: são exibidos links autenticados ao provedor, que continua aplicando suas permissões.

## Permissões

Luciano administra cadastros, honorários, todas as tarefas, aprovação de publicações, integrações e auditoria. Rafael gerencia clientes e pipeline, consulta indicadores comerciais e altera suas próprias tarefas. Gustavo consulta clientes, processos e publicações, altera suas tarefas; não acessa honorários/pipeline nem executa sincronizações ou aprovações. A carteira é compartilhada entre os três usuários; segmentação por cliente pode ser adicionada antes de ampliar a equipe. O acesso jurídico ao cliente oculta notas comerciais e propostas. Operações são protegidas no servidor, inclusive chamadas diretas a Server Actions.

## Dados e eventos

Cliente agrega propostas, serviços (honorários recorrentes e vigência), processos, tarefas, documentos, atas e linha do tempo. MRR é soma contratual dos serviços vigentes no instante, não receita recebida. Evolução reconstrói vigências para os últimos seis meses; não presume recebimentos. Conversão considera propostas encerradas (ganhas / ganhas + perdidas). Atraso usa data explicitamente cadastrada, não prazo inferido de publicação. Dados demo são marcados em cada entidade raiz; produção os exclui e recusa sessões demo. Não há seed demo em produção.

Uma publicação é deduplicada pelo identificador PROAD quando disponível; na ausência usa hash de texto canônico + processo + data. IDs PROAD distintos são mantidos mesmo para o mesmo processo. Triagem determinística e conservadora identifica marcadores, registra ausência de campos e sempre pede conferência oficial. Não se apresenta como parecer ou cálculo de prazo. IA externa é uma extensão futura, dependente de autorização para transmitir conteúdo sigiloso; não está ligada neste MVP.

A aprovação, tarefa, auditoria e outbox são gravadas em uma transação. Concorrência usa transição condicional PENDING → APPROVED; uma publicação só pode gerar uma tarefa. O worker cria no Notion apenas tarefas de publicações aprovadas, consulta antes pelo JDA ID e serializa execuções com lease persistente. Falhas ficam registradas sem corpos de resposta/segredos; retries usam backoff. Se o provedor não responder, a próxima tentativa primeiro reconcilia o JDA ID. O Notion não oferece unicidade transacional: uma resposta ambígua e consistência eventual ainda exigem conferência operacional antes de reenvio.

## Conectores

Graph lê e-mails da caixa configurada, verifica remetente exato, identificação de Luciano e OAB, e extrai cada segmento PROAD. OneDrive lê metadados por delta e uma tabela da planilha; nomes não determinam vínculo automático com cliente. Documentos/atas ficam pendentes de vínculo manual até mapeamento confirmado. Notion importa páginas existentes por page ID, preserva tarefas locais já vinculadas, e lê atas de um banco opcional. Nomes de propriedades são configuráveis. Não é feita deleção remota nem atualização de páginas existentes. Escrita externa exige APP_MODE=production e ALLOW_EXTERNAL_WRITES=true, além de aprovação humana para cada publicação.

## Implantação

Processo web e worker independente, banco privado com TLS, backups e recuperação testada. Executar migrações uma vez por release. HTTPS obrigatório, segredos no gerenciador da hospedagem, consentimento Entra restrito à caixa/site necessários. Aplicar política de retenção e monitorar SyncState, Outbox e auditoria. Antes de produção: validar os schemas reais do Notion/planilha, consentimento, RBAC real, backup/restore e homologação em tenant de teste. Nenhum conector foi considerado validado com contas reais por este trabalho.
