# Sync Cloudflare trycloudflare.com URL into .env.local as NEXT_PUBLIC_APP_URL
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $root "storage\cloudflare-tunnel.log"
$envFile = Join-Path $root ".env.local"

Write-Host "Waiting for Cloudflare public URL..."
$url = $null
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  if (-not (Test-Path $log)) { continue }
  $text = Get-Content $log -Raw -ErrorAction SilentlyContinue
  if (-not $text) { continue }
  if ($text -match "https://[a-z0-9-]+\.trycloudflare\.com") {
    $url = $Matches[0].TrimEnd("/")
    break
  }
}

if (-not $url) {
  Write-Host "ERROR: No trycloudflare.com URL found in log yet."
  Write-Host "Check the 'PawAlert Cloudflare' window / storage\cloudflare-tunnel.log"
  exit 1
}

Write-Host "Public URL: $url"

$lines = @()
if (Test-Path $envFile) {
  $lines = Get-Content $envFile
} else {
  Copy-Item (Join-Path $root ".env.example") $envFile -ErrorAction SilentlyContinue
  if (Test-Path $envFile) { $lines = Get-Content $envFile }
}

$found = $false
$out = foreach ($line in $lines) {
  if ($line -match '^\s*NEXT_PUBLIC_APP_URL\s*=') {
    $found = $true
    "NEXT_PUBLIC_APP_URL=$url"
  } else {
    $line
  }
}
if (-not $found) {
  $out = @($out) + "NEXT_PUBLIC_APP_URL=$url"
}

Set-Content -Path $envFile -Value $out -Encoding utf8
Write-Host "Updated .env.local NEXT_PUBLIC_APP_URL"
Write-Host "Restart the Next.js server so Share uses the new URL."
