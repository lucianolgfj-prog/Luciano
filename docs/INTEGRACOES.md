# Conectar fontes reais

Nada neste MVP confirma acesso às contas profissionais. Não forneça segredos no chat. Cadastre valores no gerenciador de segredos da hospedagem (ou .env local ignorado pelo Git). Confirme as permissões com o administrador Microsoft e compartilhe somente os bancos necessários com a integração Notion. Até a homologação, mantenha ALLOW_EXTERNAL_WRITES=false. Conectores não são executados em APP_MODE=demo.

## Microsoft Entra ID: login

Crie um App Registration single-tenant. Redirect URI web: `https://SEU-DOMINIO/api/auth/callback/azure-ad` (em desenvolvimento, `http://localhost:3000/api/auth/callback/azure-ad`). Configure ENTRA_TENANT_ID, ENTRA_CLIENT_ID e ENTRA_CLIENT_SECRET no servidor; NEXTAUTH_URL deve ser a URL pública HTTPS. Defina NEXTAUTH_SECRET aleatório (32 bytes ou mais), APP_MODE=production e DEMO_LOGIN_ENABLED=false. Restrinja assignment do aplicativo aos três usuários. Aplique MFA/Conditional Access no tenant.

Defina LUCIANO_EMAIL, RAFAEL_EMAIL e GUSTAVO_EMAIL com as identidades profissionais distintas; devem corresponder ao `preferred_username` do Entra. Execute `npm run db:seed` nesse modo para provisionar SOMENTE as três identidades reais, sem dados demo. Usuários fora da allowlist, de outro tenant, desativados ou demo são rejeitados. Não provisionamos ou alteramos contas no Microsoft automaticamente.

## Microsoft Graph: Outlook e OneDrive

Use um registro separado para o worker (GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET), fluxo client credentials. Consinta Mail.Read e restrinja a caixa com Exchange Online Application RBAC (ou a política suportada no seu tenant). Restrinja documentos com Sites.Selected e concessão explícita ao site relevante quando aplicável; OneDrive pessoal/profissional pode exigir Files.Read.All, que é amplo e deve ser analisado pelo administrador antes do consentimento. Não são necessários Mail.Send ou permissões de escrita de arquivos. O login web usa somente openid/profile/email, não recebe tokens Graph.

Configure OUTLOOK_MAILBOX com o UPN/ID da caixa profissional; JUSBRASIL_SENDER com o remetente exato verificado nos alertas reais. A importação exige from e sender iguais à configuração, nome completo normalizado, OAB 64.721 e GO/Goiás no corpo. Alertas com outros formatos podem precisar de adaptação após revisão de amostras anonimizadas. Um endereço from não é prova criptográfica de origem: políticas antiphishing/DMARC do Microsoft e conferência oficial continuam necessárias.

A primeira leitura cobre 30 dias, páginas completas até um limite operacional de 100 páginas. O checkpoint usa margem de cinco minutos; a deduplicação impede reimportações. Segmente janelas maiores em uma tarefa de backfill revisada. Cada ocorrência PROAD recebe identidade própria. Sem PROAD, o hash usa o texto normalizado, número e data. Não deduplicamos somente por processo. Campos não encontrados permanecem nulos. Não há cálculo de prazo.

Configure ONEDRIVE_DRIVE_ID e ONEDRIVE_ROOT_ID com IDs confirmados da pasta profissional. O delta atualiza metadados; arquivo removido fica sinalizado, não deletamos o cadastro ou o documento real. A tela de Integrações permite confirmar vínculos com clientes. Acesso ao conteúdo continua pelo link autenticado no OneDrive; o aplicativo não disponibiliza cópia pública.

Para leads, identifique o item .xlsx e configure ONEDRIVE_LEADS_ITEM_ID. A tabela nomeada ONEDRIVE_LEADS_TABLE (padrão Leads) deve ter Nome, Email, Telefone e Etapa. O worker baixa o .xlsx com Graph (não usa endpoints Excel de workbook, que não suportam credenciais de aplicativo), lê tabela com ExcelJS e limita o arquivo a 10 MB. URLs temporárias de download ficam só no servidor e não são registradas. Nome/email inválidos são ignorados. E-mail normalizado serve como chave, evitando duplicar linhas reordenadas. Leads novos entram inativos com proposta LEAD, valor 0, para revisão; Etapa da fonte não altera negócio ou contratos automaticamente. Valores, alterações de contato e etapas existentes são preservados para evitar sobrescrever revisão local. Cliente compartilhando e-mail ou mudança de endereço exige revisão manual; não é uma identidade universal.

## Notion: controladoria e atas

Crie uma integração interna e compartilhe o banco controladoria. Configure NOTION_TOKEN e NOTION_DATABASE_ID. Para leitura somente, habilite apenas capacidade Read content. Para envio aprovado, conceda Insert content após autorização expressa; Update content não é utilizado. Versão da API fixada em 2022-06-28; esta implementação usa endpoints de databases dessa versão.

O banco deve conter Nome (title), Status (status) e JDA ID (rich_text). Configure nomes alternativos em NOTION_TITLE_PROPERTY, NOTION_STATUS_PROPERTY e NOTION_EXTERNAL_ID_PROPERTY. NOTION_PENDING_STATUS deve corresponder a uma opção existente no Status. A implementação valida o schema na leitura. Criar propriedades em um banco real é uma mudança que deve ser autorizada e feita pelo responsável; o código não as cria automaticamente.

Tarefas existentes são importadas por page ID. Inicialmente ficam sob Gustavo, sem cliente e sem prazo presumido: Luciano deve confirmar responsável/cliente e data na controladoria. Status contendo "conclu"/"done" é DONE, "andamento"/"progress" é IN_PROGRESS, demais PENDING; valide as opções reais em homologação. Importações posteriores atualizam título/status de tarefas originadas no Notion; alterações locais são preservadas e eventuais conflitos aparecem na tela. "Aceitar fonte na próxima leitura" autoriza atualizar a cópia local, não escrever na página real. Tarefas locais e tarefas aprovadas já vinculadas não são substituídas. Arquivamento remoto não deleta tarefas locais.

NOTION_MEETINGS_DATABASE_ID é opcional, precisa ser compartilhado e conter título e, opcionalmente, Data(date). Atas são sincronizadas como referência e URL, sem copiar blocos confidenciais. Vínculo com cliente é manual.

## Envio de publicações aprovadas

O envio exige APP_MODE=production, ALLOW_EXTERNAL_WRITES=true, permissão Insert content e aprovação de Luciano de cada publicação após conferência oficial. Habilitar a flag autoriza o worker a criar páginas para TODAS as tarefas aprovadas que aguardam envio: revise a fila antes. A demonstração nunca escreve, mesmo com a flag. Não habilite sem autorização para essa operação concreta.

Outbox mantém tarefa, tentativas, falha e próxima execução. O worker consulta JDA ID antes de criar e vincula a página encontrada; não atualiza/deleta páginas remotas. Lease por conector serializa execução e jobs têm lease curto. Falhas geram backoff exponencial até uma hora. A próxima execução consulta novamente o Notion antes de tentar criar. Respostas ambíguas e consistência eventual podem exigir reconciliação manual; o Notion não oferece chave única/idempotency key transacional. Não prometa exactly-once externo.

Execute `npm run sync -- outlook`, `npm run sync -- onedrive`, `npm run sync -- notion` ou `npm run sync -- outbox`. Sem argumento executa todos e retorna código não-zero se algum falhar. Agende em worker/cron separado (por exemplo a cada cinco minutos), usando os mesmos segredos e banco; não cron no navegador. Registros técnicos contêm status e IDs locais, nunca tokens/corpos de erros de API. Monitorar últimas execuções, conflitos, fila FAILED e publicações pendentes.

## Rede e homologação

Destinos: login.microsoftonline.com, graph.microsoft.com, api.notion.com; para download Excel também o hostname exato do SharePoint/OneDrive retornado pelo Graph. Prefira permitir o domínio específico do tenant, não todos os SharePoints. Nunca desabilite TLS, checksums ou assinatura para contornar rede. Segredos Graph/Notion precisam estar disponíveis ao processo servidor: placeholders substituídos apenas em proxies HTTPS não servem automaticamente para client_secret em corpo OAuth. Verifique o mecanismo suportado da hospedagem.

Antes de dados reais: login com cada usuário; teste de negação para outra conta/tenant; Mail.Read na caixa correta; delta em pasta de teste; importação repetida de planilha reordenada; leitura repetida da controladoria; revisão de publicação duplicada/ambígua; criar UMA tarefa aprovada em banco Notion de homologação; simular 403/429/timeouts e verificar retry/reconciliação. Depois obter aprovação do responsável para habilitar escrita no banco real. Não enviar documentos a provedores de IA sem política e autorização específicas.
