<#
  Workstack - atalho no Menu Iniciar com tecla de atalho global (abre o app sem prompt de comando).

  Uso (na pasta workstack):
    npm run instalar-windows
    npm run instalar-windows -- -Hotkey "CTRL+ALT+K"     (outra combinacao)
    npm run instalar-windows -- -Remove                  (remove o atalho)

  O atalho abre o Workstack; se ele ja estiver aberto, apenas traz a janela para a frente
  (o app aceita uma unica instancia). O inicio automatico com o Windows e feito pelo proprio app
  (botao do foguete na barra do widget).
#>
param(
  [string]$Hotkey = 'CTRL+ALT+W',
  [switch]$Remove
)
$ErrorActionPreference = 'Stop'

$appDir   = $PSScriptRoot
$electron = Join-Path $appDir 'node_modules\electron\dist\electron.exe'
$link     = Join-Path ([Environment]::GetFolderPath('Programs')) 'Workstack.lnk'

if ($Remove) {
  if (Test-Path $link) { Remove-Item $link -Force; Write-Host "Atalho removido: $link" }
  else { Write-Host 'Nenhum atalho para remover.' }
  return
}

if (-not (Test-Path $electron)) {
  throw "Electron nao encontrado em: $electron`nRode 'npm install' nesta pasta e tente de novo."
}

$Hotkey = $Hotkey.ToUpper()
if ($Hotkey -notmatch '^(CTRL|ALT|SHIFT)(\+(CTRL|ALT|SHIFT))*\+([A-Z0-9]|F([1-9]|1[0-2]))$') {
  throw "Combinacao invalida: '$Hotkey'. Exemplo: CTRL+ALT+W"
}

$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut($link)
$s.TargetPath       = $electron
$s.Arguments        = '"' + $appDir + '"'
$s.WorkingDirectory = $appDir
$s.IconLocation     = "$electron,0"
$s.Description      = 'Workstack'
$s.Hotkey           = $Hotkey
$s.Save()

Write-Host ''
Write-Host "Atalho criado: $link"
Write-Host "Tecla de atalho: $Hotkey (abre o Workstack ou traz a janela para a frente)"
Write-Host 'Se a tecla nao responder de imediato, saia e entre no Windows ou reinicie o Explorer.'
Write-Host 'Para escolher outra combinacao ou remover, veja o inicio deste arquivo.'
