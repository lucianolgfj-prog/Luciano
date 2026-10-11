# Conectar as contas profissionais a partir do Windows

A página funcionando no computador é uma demonstração. Acesso a e-mail, OneDrive e Notion exige configuração e autorização nas respectivas contas. Os conectores existem, mas não há credenciais profissionais incluídas no projeto. Só informar o endereço de e-mail não concede acesso.

## Etapa 1: acesso individual e banco real separado

Comece pelo responsável pelo Microsoft 365 do escritório. Abra https://entra.microsoft.com com a conta profissional e procure **Registros de aplicativos / App registrations**. Se o usuário não puder registrar aplicações, peça ao administrador para preparar o registro de login descrito em [INTEGRACOES.md](INTEGRACOES.md). Não solicite permissões de e-mail ou documentos para esse registro: o login e o worker Graph usam aplicativos separados.

Identidades já informadas para a allowlist:

| Papel                  | Identidade profissional           |
| ---------------------- | --------------------------------- |
| Luciano, administrador | lucianofaria@joaodomingosadv.com  |
| Rafael, comercial      | rafael.paula@joaodomingosadv.com  |
| Gustavo, jurídico      | gustavo.neves@joaodomingosadv.com |

Confirme com a TI que esses e-mails correspondem às identidades de entrada do tenant. Configure callback local `http://localhost:3000/api/auth/callback/azure-ad`, `NEXTAUTH_URL=http://localhost:3000`, as variáveis ENTRA e a allowlist. Configure um PostgreSQL separado e vazio para os dados profissionais; preserve o volume do banco demonstrativo. Use `APP_MODE=production`, `DEMO_LOGIN_ENABLED=false`, `LOCAL_DEMO_BYPASS=false` e `ALLOW_EXTERNAL_WRITES=false` no perfil real. Faça geração, migração e seed nesse banco, que provisionará somente os três usuários profissionais, e valide login e permissões antes de importar dados.

Não execute `scripts/start-local-demo.cmd` para integrar contas reais: ele força modo demo e acesso direto, e os conectores ficam desativados. O ambiente real deve iniciar pelo processo normal do Next.js com as variáveis de produção da aplicação; APP_MODE é independente de NODE_ENV. Na homologação local, mantenha o processo restrito ao loopback. Use endereço HTTPS quando hospedar, e registre o callback correspondente no Entra.

## Etapa 2: leitura de Outlook e OneDrive

A TI prepara o aplicativo Graph com os privilégios mínimos e o consentimento conforme [INTEGRACOES.md](INTEGRACOES.md). Caixa esperada: `lucianofaria@joaodomingosadv.com`. Precisamos também do remetente real dos alertas Jusbrasil, da pasta de documentos e da planilha de leads. Os links identificam as fontes; o worker ainda precisa dos IDs Graph confirmados. O link não substitui permissão.

Configure credenciais no servidor local em arquivo `.env` ignorado pelo Git, nunca no navegador ou chat. Teste primeiro os acessos em pasta/planilha de homologação; confirme a importação e a deduplicação antes de importar o conjunto autorizado. Não há permissão Mail.Send nem escrita em documentos. A sincronização cria/atualiza cópias no banco local e mantém as fontes intactas.

## Etapa 3: leitura da controladoria do Notion

Compartilhe somente os bancos necessários com uma integração interna Notion, inicialmente com **Read content**. Informe o link do banco e os nomes/tipos das propriedades; qualquer mudança de schema deve ser revista antes de alterar o banco real. Esta versão exige título, Status do tipo status e JDA ID do tipo rich_text, com nomes configuráveis. Não criamos propriedades automaticamente.

O token é cadastrado apenas no servidor. Importe as tarefas por ID da página e repita a leitura para conferir que não duplicam. Luciano confirma vínculos com clientes, responsáveis e datas, sem inferir prazos. Atas podem ser vinculadas como referências; não copiamos seu conteúdo confidencial para a interface.

## Etapa 4: escrita aprovada no Notion

Só depois de homologar leitura, revisão e duplicidades, teste UMA publicação aprovada em banco Notion de homologação. Para uso real, revise a fila e obtenha autorização específica antes de conceder Insert content e habilitar ALLOW_EXTERNAL_WRITES. O worker não altera nem exclui páginas existentes; cada criação exige publicação previamente aprovada por Luciano e conferência oficial. Nenhum prazo processual é calculado definitivamente.

## Informações que podem ser enviadas no chat

Links/IDs das fontes autorizadas, remetente Jusbrasil, nomes/tipos de propriedades e resultado sem segredos dos testes. Nunca envie tokens, client secrets, senhas, URLs de banco com credenciais, corpo de e-mails ou documentos sigilosos. Toda verificação em contas reais depende dos acessos configurados; testes com mocks não confirmam conexão profissional.
