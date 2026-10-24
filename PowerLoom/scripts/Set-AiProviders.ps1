# Settings -> AI providers from the command line, all optional (user request 2026-10-24): install.ps1 runs it once
# PowerLoom answers, and it can be run again any time. Whatever is skipped here is set later in Settings -> AI providers,
# which shows and changes the same values. A provider that is already connected is left as it is.
#
#   pwsh scripts/Set-AiProviders.ps1 [-Api <url>] [-ClaudeToken <token>] [-ConnectCodex] [-ChatApp claude-desktop|codex-desktop] [-NonInteractive]
#
# -Api: PowerLoom's API; default http://127.0.0.1:<POWERLOOM_PORT from .env>.
# -ClaudeToken: the token `claude setup-token` prints; else $env:CLAUDE_CODE_OAUTH_TOKEN; else asked (Enter skips).
# -ConnectCodex: connect Codex with the ChatGPT plan without asking (a device code: open the link, enter the code).
# -ChatApp: the app "Continue with ..." opens; asked only when more than one is connected.
# -NonInteractive: ask nothing; only what the parameters give is set.
param(
    [string]$Api,
    [string]$ClaudeToken,
    [switch]$ConnectCodex,
    [ValidateSet("claude-desktop", "codex-desktop")][string]$ChatApp,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"

$CodexPollSeconds = 5
$CodexWaitMinutes = 15

function Get-DefaultApi {
    $envFile = Join-Path (Split-Path -Parent $PSScriptRoot) ".env"
    $line = Get-Content $envFile -ErrorAction SilentlyContinue | Where-Object { $_ -match "^POWERLOOM_PORT=" } | Select-Object -First 1
    $port = (($line -replace "^POWERLOOM_PORT=", "") -replace "\s+#.*$", "").Trim()

    return "http://127.0.0.1:$(if ($port) { $port } else { '5180' })"
}

# PowerLoom answers an expected failure with ProblemDetails: its detail is the message (without its full stop: the
# warning goes on after it).
function Get-ProblemText($errorRecord) {
    return (Get-ProblemDetail $errorRecord).TrimEnd(".")
}

function Get-ProblemDetail($errorRecord) {
    try {
        return ($errorRecord.ErrorDetails.Message | ConvertFrom-Json).detail ?? $errorRecord.Exception.Message
    }
    catch {
        return $errorRecord.Exception.Message
    }
}

# Invoke-RestMethod hands a JSON array on as one object; Write-Output unrolls it, so a list answer is its items.
function Invoke-PowerLoom([string]$method, [string]$path, $body = $null) {
    $request = @{ Method = $method; Uri = "$Api$path"; ContentType = "application/json" }

    if ($null -ne $body) {
        $request.Body = $body | ConvertTo-Json -Compress
    }

    Invoke-RestMethod @request | Write-Output
}

function Get-Provider([string]$provider) {
    return @(Invoke-PowerLoom "Get" "/api/ai-providers") | Where-Object { $_.provider -eq $provider } | Select-Object -First 1
}

function Read-Secret([string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString

    return [System.Net.NetworkCredential]::new("", $secure).Password
}

function Test-Yes([string]$prompt) {
    return (Read-Host "$prompt [y/N]") -match "^(y|yes)$"
}

function Get-ClaudeTokenToSave {
    if ($ClaudeToken) {
        return $ClaudeToken
    }

    if ($env:CLAUDE_CODE_OAUTH_TOKEN) {
        return $env:CLAUDE_CODE_OAUTH_TOKEN
    }

    if ($NonInteractive) {
        return ""
    }

    return Read-Secret "Claude token (run claude setup-token and paste what it prints; Enter skips)"
}

function Set-Claude {
    $claude = Get-Provider "anthropic"

    if ($claude.connected -and -not $ClaudeToken) {
        Write-Host "Claude: connected ($(if ($claude.source -eq 'env') { 'CLAUDE_CODE_OAUTH_TOKEN in .env' } else { 'token saved in Settings' }))."

        return
    }

    $token = Get-ClaudeTokenToSave

    if (-not $token) {
        Write-Host "Claude: skipped. Agents on Claude models wait until a token is saved in Settings -> AI providers."

        return
    }

    Save-ClaudeToken $token
}

function Save-ClaudeToken([string]$token) {
    try {
        Invoke-PowerLoom "Put" "/api/ai-providers/claude/token" @{ token = $token } | Out-Null
        Write-Host "Claude: connected with the token saved in Settings."
    }
    catch {
        Write-Warning "Claude: not saved: $(Get-ProblemText $_). Set it in Settings -> AI providers."
    }
}

function Set-Codex {
    $codex = Get-Provider "openai-codex"

    if ($codex.connected) {
        Write-Host "Codex: connected."

        return
    }

    if (-not (Test-WantsCodex)) {
        Write-Host "Codex: skipped. Connect it any time in Settings -> AI providers."

        return
    }

    Connect-Codex
}

function Test-WantsCodex {
    if ($ConnectCodex) {
        return $true
    }

    if ($NonInteractive) {
        return $false
    }

    return Test-Yes "Connect Codex now (agents on your ChatGPT plan)?"
}

function Connect-Codex {
    Write-Host "First switch on 'Device code authorization' in ChatGPT -> Settings -> Security."

    try {
        Show-CodexCode (Invoke-PowerLoom "Post" "/api/ai-providers/codex/login" @{})
        Wait-CodexLogin
    }
    catch {
        Write-Warning "Codex: not connected: $(Get-ProblemText $_). Try again in Settings -> AI providers, or upload an auth.json there."
    }
}

# The device flow is beta: when the link or the code can't be read, the CLI's own text is shown.
function Show-CodexCode($start) {
    if ($start.verificationUri -and $start.userCode) {
        Write-Host "Open $($start.verificationUri) and enter the code $($start.userCode), then sign in with your ChatGPT account."

        return
    }

    Write-Host $start.output
}

function Wait-CodexLogin {
    $deadline = (Get-Date).AddMinutes($CodexWaitMinutes)
    $status = Get-CodexLoginStatus

    while ($status.status -eq "pending" -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $CodexPollSeconds
        $status = Get-CodexLoginStatus
    }

    Write-CodexResult $status
}

function Get-CodexLoginStatus {
    return Invoke-PowerLoom "Get" "/api/ai-providers/codex/login"
}

function Write-CodexResult($status) {
    if ($status.status -eq "done") {
        Write-Host "Codex: connected."

        return
    }

    $reason = if ($status.status -eq "pending") { "the sign-in wasn't finished in $CodexWaitMinutes minutes" } else { $status.error }

    Write-Warning "Codex: not connected: $reason. Try again in Settings -> AI providers, or upload an auth.json there."
}

# Only connected apps can be chosen; with one there is nothing to ask.
function Set-ChatApp {
    $apps = Invoke-PowerLoom "Get" "/api/chats/apps"
    $connected = @($apps.apps | Where-Object { $_.connected })
    $choice = Get-ChatAppChoice $apps.current $connected

    if (-not $choice -or $choice -eq $apps.current) {
        Write-Host "Chat app: $(Get-AppLabel $apps.apps $apps.current)."

        return
    }

    Save-ChatApp $choice $apps.apps
}

function Get-ChatAppChoice([string]$current, $connected) {
    if ($ChatApp) {
        return $ChatApp
    }

    if ($NonInteractive -or $connected.Count -lt 2) {
        return ""
    }

    $labels = for ($index = 0; $index -lt $connected.Count; $index++) { "$($index + 1)) $($connected[$index].label)" }
    $answer = Read-Host "Chat app for Continue with ... ($($labels -join ', '); Enter keeps $(Get-AppLabel $connected $current))"

    return $answer -match "^\d+$" -and [int]$answer -ge 1 -and [int]$answer -le $connected.Count ? $connected[[int]$answer - 1].id : ""
}

function Save-ChatApp([string]$id, $apps) {
    try {
        Invoke-PowerLoom "Put" "/api/chats/app" @{ launcher = $id } | Out-Null
        Write-Host "Chat app: $(Get-AppLabel $apps $id)."
    }
    catch {
        Write-Warning "Chat app: not changed: $(Get-ProblemText $_)."
    }
}

function Get-AppLabel($apps, [string]$id) {
    return ($apps | Where-Object { $_.id -eq $id } | Select-Object -First 1).label ?? $id
}

function Set-AiProviders {
    if (-not $Api) {
        $script:Api = Get-DefaultApi
    }

    Write-Host ""
    Write-Host "AI providers (optional; Settings -> AI providers changes them any time):"
    Set-Claude
    Set-Codex
    Set-ChatApp
}

# Dot-sourced by the tests: only the functions load.
if ($MyInvocation.InvocationName -ne ".") {
    Set-AiProviders
}
