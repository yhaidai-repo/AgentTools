<#
.SYNOPSIS
    Runs DevHub: a small HTTP API on this machine through which PowerLoom's agents (in Docker) start,
    inspect and stop local stacks (Start-/Get-/Stop-LocalStack.ps1).

.DESCRIPTION
    Listens on 127.0.0.1 only; containers reach it as http://host.docker.internal:<port>.
    Every call except /health needs "Authorization: Bearer <token>", the dev-secrets value "dev-hub-token"
    (created on the first run; never printed).
    A stack stops when its time is up (ttlMinutes, default 60) and when DevHub stops (Ctrl+C).

    GET    /services                    runnable services
    POST   /stack {services, branch?, ttlMinutes?}   start (202); GET /stack until phase is ready or failed
    GET    /stack                       phase, services, start output
    GET    /stack/logs/{service}?lines=200&error=false
    DELETE /stack                       stop
    POST   /browser {owner, case, url?, headless?}   open a recorded browser case (video + trace under <stack>/browser/<owner>/<case>/)
    GET    /browser                     the open case
    POST   /browser/act {action, ...}   navigate, click, fill, press, select, check, uncheck, hover; answers with the page's snapshot
    GET    /browser/snapshot            the page's accessibility snapshot
    DELETE /browser?owner=              close the case; answers with its files
    GET    /browser/artifacts?owner=    the owner's recordings

.EXAMPLE
    ./Start-DevHub.ps1
#>
[CmdletBinding()]
param(
    [int] $Port = 47811,
    # The browser the Playwright MCP drives: the installed "msedge" (default; no download) or "chrome", or Playwright's
    # own "chromium" (needs `npx playwright install chromium` once; its downloader stalls on some networks).
    [ValidateSet("msedge", "chrome", "chromium")]
    [string] $Browser = "msedge"
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot/DevSecrets.Common.ps1"

$TokenValue = "dev-hub-token"
$TokenBytes = 32

function New-Token() {
    return [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes($TokenBytes)).ToLowerInvariant()
}

function Add-TokenValue([string] $ValuesPath) {
    $values = Read-JsonFile $ValuesPath
    $values[$TokenValue] = New-Token
    $sorted = [ordered]@{}

    $values.Keys | Sort-Object | ForEach-Object { $sorted[$_] = $values[$_] }
    $sorted | ConvertTo-Json | Set-Content -LiteralPath $ValuesPath -Encoding utf8NoBOM
    Write-Host "Created the dev-secrets value '$TokenValue' (give it to PowerLoom; not printed here)."
}

function Get-HubToken() {
    $valuesPath = Join-Path $ValuesDir "values.dev.json"

    if (-not (Read-JsonFile $valuesPath).ContainsKey($TokenValue)) {
        Add-TokenValue $valuesPath
    }

    return (Read-JsonFile $valuesPath)[$TokenValue]
}

$env:DevHub__Token = Get-HubToken
$env:DevHub__ScriptsDir = $PSScriptRoot
$env:DevHub__ValuesDir = $ValuesDir
$env:DevHub__BrowserArtifactsDir = Join-Path $StackDir "browser"
$env:ASPNETCORE_URLS = "http://127.0.0.1:$Port"

Write-Host "DevHub on http://127.0.0.1:$Port (containers: http://host.docker.internal:$Port). Ctrl+C stops it and its stack."
$project = Join-Path $PSScriptRoot "DevHub/DevHub.csproj"

dotnet build $project -c Release --nologo -v quiet
if ($LASTEXITCODE -ne 0) { throw "DevHub build failed" }

# The Playwright MCP (pinned in DevHub/playwright-mcp/package.json) drives the browser for the agents; installed once.
$mcpDir = Join-Path $PSScriptRoot "DevHub/playwright-mcp"

if (-not (Test-Path (Join-Path $mcpDir "node_modules/@playwright/mcp/cli.js"))) {
    Write-Host "Installing the Playwright MCP into $mcpDir"
    npm install --prefix $mcpDir --no-audit --no-fund --loglevel error

    if ($LASTEXITCODE -ne 0) { throw "npm install of the Playwright MCP failed" }
}

# The video recorder (ffmpeg) of the MCP's Playwright: its own downloader stalls on some networks (seen 2026-10-20:
# curl fetches in a second, Node times out), so it is fetched by hand from the mirror into Playwright's cache.
function Install-FfmpegByHand() {
    $browsers = Get-Content (Join-Path $mcpDir "node_modules/playwright-core/browsers.json") -Raw | ConvertFrom-Json
    $revision = ($browsers.browsers | Where-Object name -eq "ffmpeg").revision
    $folder = Join-Path $env:LOCALAPPDATA "ms-playwright/ffmpeg-$revision"
    $zip = Join-Path $env:TEMP "playwright-ffmpeg-$revision.zip"

    if (Test-Path (Join-Path $folder "INSTALLATION_COMPLETE")) {
        return $true
    }

    try {
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -OutFile $zip "https://playwright.download.prss.microsoft.com/dbazure/download/playwright/builds/ffmpeg/$revision/ffmpeg-win64.zip"
        New-Item -ItemType Directory -Force -Path $folder | Out-Null
        Expand-Archive -Force -LiteralPath $zip -DestinationPath $folder
        New-Item -ItemType File -Force -Path (Join-Path $folder "INSTALLATION_COMPLETE") | Out-Null

        return $true
    } catch {
        Write-Warning "ffmpeg by hand failed: $($_.Exception.Message)"

        return $false
    } finally {
        Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Install-FfmpegByHand)) {
    Write-Warning "Playwright's ffmpeg could not be downloaded: browser cases record no video."
}

$env:DevHub__McpDir = $mcpDir
$env:DevHub__BrowserChannel = $Browser
dotnet run --project $project -c Release --no-build
