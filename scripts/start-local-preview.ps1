param(
    [ValidateRange(1024, 65535)][int]$Port = 5173,
    [switch]$Rebuild,
    [string]$NodePath
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$vitePath = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
$tscPath = Join-Path $projectRoot 'node_modules\typescript\bin\tsc'
$indexPath = Join-Path $projectRoot 'dist\index.html'
$baseUrl = "http://127.0.0.1:$Port"

if (-not $NodePath) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) { $NodePath = $nodeCommand.Source }
    else {
        $NodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    }
}
if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) { throw 'Node.js was not found. Pass -NodePath with its full path.' }
if (-not (Test-Path -LiteralPath $vitePath -PathType Leaf)) { throw 'Project dependencies are missing. Run npm ci first.' }

$running = $null
try { $running = Invoke-WebRequest -Uri $baseUrl -UseBasicParsing -TimeoutSec 1 } catch { }
if ($running) {
    $currentHtml = if (Test-Path -LiteralPath $indexPath) { Get-Content -LiteralPath $indexPath -Raw } else { '' }
    $currentAsset = [regex]::Match($currentHtml, 'src="(/assets/[^\"]+\.js)"').Groups[1].Value
    if ($currentAsset -and $running.Content.Contains($currentAsset) -and -not $Rebuild) {
        Write-Output "Preview is already running: $baseUrl/#/select-role"
        return
    }
    throw "Port $Port is already in use. Stop the existing preview before rebuilding, or choose another -Port."
}
$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($listener) { throw "Port $Port is occupied by another service. Choose another -Port." }

if ($Rebuild -or -not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
    Push-Location $projectRoot
    try {
        & $NodePath $tscPath -b
        if ($LASTEXITCODE -ne 0) { throw 'TypeScript verification failed; preview was not started.' }
        & $NodePath $vitePath build
        if ($LASTEXITCODE -ne 0) { throw 'Production build failed; preview was not started.' }
    } finally { Pop-Location }
}

$logDirectory = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$arguments = @(('"{0}"' -f $vitePath), 'preview', '--host', '127.0.0.1', '--port', "$Port", '--strictPort')
$process = Start-Process -FilePath $NodePath -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logDirectory "preview-$Port.out.log") `
    -RedirectStandardError (Join-Path $logDirectory "preview-$Port.err.log")

$timer = [Diagnostics.Stopwatch]::StartNew()
do {
    if ($process.HasExited) { throw "Preview exited. See logs/preview-$Port.err.log." }
    try {
        $response = Invoke-WebRequest -Uri $baseUrl -UseBasicParsing -TimeoutSec 1
        if ($response.StatusCode -eq 200) {
            [pscustomobject]@{ pid = $process.Id; port = $Port; projectRoot = $projectRoot; startedAt = [DateTimeOffset]::UtcNow.ToString('o') } |
                ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logDirectory "preview-$Port.json") -Encoding utf8
            Write-Output "Customer: $baseUrl/#/login"
            Write-Output "Barber: http://localhost:$Port/#/barber/login"
            Write-Output 'These two origins keep the customer and barber sign-ins separate.'
            Write-Output 'This preview uses the configured live Firebase and Supabase services. Use dedicated test accounts.'
            return
        }
    } catch { if ($timer.Elapsed.TotalSeconds -ge 20) { throw } }
    Start-Sleep -Milliseconds 250
} while ($timer.Elapsed.TotalSeconds -lt 20)
throw "Preview did not respond within 20 seconds. See logs/preview-$Port.err.log."
