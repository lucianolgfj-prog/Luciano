# Entrada local sem tela de login no Windows

Para avaliar a demonstração no seu próprio computador, use `scripts/start-local-demo.cmd`. Ele inicia o banco existente, gera o cliente, aplica migrações, completa o seed idempotente e abre o servidor apenas em `127.0.0.1:3000`. O acesso passa a ser direto como Luciano administrador; não é necessário clicar em um perfil. Deixe Docker Desktop e o terminal abertos.

O launcher define APP_MODE=demo e LOCAL_DEMO_BYPASS=true somente para esse processo. Não modifica a `.env`, não exclui registros e não configura integrações reais. Todos os registros e a auditoria permanecem no PostgreSQL. Não use dados de clientes reais nessa demonstração.

A entrada direta exige modo demo, execução de desenvolvimento, flag explícita e Host de loopback. É desativada em builds de produção e nas hospedagens Render/Vercel/Codespaces. O servidor iniciado pelo launcher escuta somente em loopback; não crie túneis nem proxies para esse modo. O launcher não serve para outros computadores ou uso multiusuário real. Para testar os três perfis e o login normal, pare com Ctrl+C e execute `npm.cmd run dev`.

## Atualizar uma cópia já baixada

Com o servidor parado, abra PowerShell na pasta que contém package.json e execute:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/lucianolgfj-prog/Luciano/jda-demo/scripts/atualizar-acesso-local.ps1" -OutFile "$env:TEMP\jda-acesso-local.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\jda-acesso-local.ps1"
.\scripts\start-local-demo.cmd
```

O script de atualização baixa apenas os arquivos de acesso local, verifica os hashes do pacote e preserva cópias dos arquivos anteriores em `node_modules/.cache/jda-local-backup/`. Não lê nem altera segredos, banco ou `.env`. A política Bypass vale somente para esse processo, sem alterar a política do Windows. Antes de executar, você pode revisar o script no repositório. Se o GitHub exigir autenticação para acessar o repositório, baixe o novo ZIP na branch jda-demo estando conectado ao GitHub e copie os arquivos listados em scripts/local-access-manifest.json sobre a pasta existente. Preserve sua `.env` e next.config.ts; não extraia o projeto em uma nova pasta, pois isso mudaria o nome do volume do Compose.

Depois de reiniciar o computador, abra o Docker e execute novamente `.\scripts\start-local-demo.cmd` dentro da pasta do projeto. Se algum preparo do banco falhar, o launcher para nesse ponto e mostra o erro; ele não ignora falhas de migração ou seed.
