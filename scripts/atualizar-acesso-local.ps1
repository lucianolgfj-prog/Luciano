$ErrorActionPreference = 'Stop'
$project = (Get-Location).Path
if (!(Test-Path (Join-Path $project 'package.json'))) { throw 'Abra o PowerShell dentro da pasta Luciano-jda-demo.' }
$package = Get-Content (Join-Path $project 'package.json') -Raw | ConvertFrom-Json
if ($package.name -ne 'jda-gestao-integrada') { throw 'Esta pasta nao e o projeto JDA.' }
if (!(Test-Path (Join-Path $project 'node_modules'))) { throw 'Execute npm.cmd ci antes de atualizar.' }
$base = 'https://raw.githubusercontent.com/lucianolgfj-prog/Luciano/jda-demo/'
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('jda-update-' + [guid]::NewGuid().ToString())
$backup = Join-Path $project ('node_modules/.cache/jda-local-backup/' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $stage -Force | Out-Null
$files = @('lib/auth.ts', 'lib/local-demo.ts', 'components/shell.tsx', 'scripts/start-local-demo.cmd')
$installed = @()
try {
  Invoke-WebRequest -UseBasicParsing -Uri ($base + 'scripts/local-access-manifest.json') -OutFile (Join-Path $stage 'manifest.json')
  $manifest = Get-Content (Join-Path $stage 'manifest.json') -Raw | ConvertFrom-Json
  foreach ($file in $files) {
    $download = Join-Path $stage $file
    New-Item -ItemType Directory -Path (Split-Path $download) -Force | Out-Null
    Invoke-WebRequest -UseBasicParsing -Uri ($base + $file) -OutFile $download
    $expected = $manifest.PSObject.Properties[$file].Value
    if (!$expected -or (Get-FileHash $download -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw ('Integridade invalida: ' + $file) }
  }
  foreach ($file in $files) {
    $target = Join-Path $project $file
    $saved = Join-Path $backup $file
    if (Test-Path $target) {
      New-Item -ItemType Directory -Path (Split-Path $saved) -Force | Out-Null
      Copy-Item $target $saved
    }
    New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
    $installed += $file
    Copy-Item (Join-Path $stage $file) $target -Force
  }
  Write-Host 'Atualizacao concluida. Banco, .env e next.config.ts preservados.'
  Write-Host 'Execute: .\scripts\start-local-demo.cmd'
} catch {
  foreach ($file in $installed) {
    $target = Join-Path $project $file
    $saved = Join-Path $backup $file
    if (Test-Path $saved) { Copy-Item $saved $target -Force } elseif (Test-Path $target) { Remove-Item $target -Force }
  }
  throw
} finally {
  Remove-Item $stage -Recurse -Force
}
