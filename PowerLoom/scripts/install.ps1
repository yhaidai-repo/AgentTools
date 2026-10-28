# First installation of PowerLoom on a Windows PC with Docker Desktop (user decision 2026-10-24). Safe to run again:
# every step keeps what is already there (.env, folders, the database volume, vaults).
# The agents and their prompts need no step: the agent-runner adds every built-in agent with the prompt files shipped in
# the code when it starts. Each vault added here gets the vault review schedule (every 6 hours) from Add vault.
#
#   pwsh scripts/install.ps1 -Vaults <folder>/<vault>[,<folder>/<other vault>] [-ReposRoot <folder>] [-SkillsPath <folder>]
#       [-ClaudeToken <token>] [-ConnectCodex] [-ChatApp claude-desktop|codex-desktop] [-SkipProviders]
#
# No path is assumed: every one comes from a parameter or from where this repository was cloned.
# -Vaults: the vault folders, full paths. PowerLoom mounts one vaults root, so they must share one parent folder (not a drive root); it
#   becomes VAULTS_ROOT, and PowerLoom's own backlog vault is created next to them. A missing folder is created from
#   PowerLoom's templates (your notes aren't copied).
# -ReposRoot: the folder with the code repos agents may read; default: the folder this repository was cloned into.
# -SkillsPath: extra skills agents may load; default: Claude Code's skills folder if there is one, else an empty
#   PowerLoom/local-skills.
# AI providers are optional here (user request 2026-10-24): once PowerLoom answers, Set-AiProviders.ps1 asks for the
#   Claude token (-ClaudeToken or $env:CLAUDE_CODE_OAUTH_TOKEN skip the question), offers to connect Codex with a device
#   code (-ConnectCodex) and the chat app (-ChatApp). Enter skips each; -SkipProviders skips the step. Settings -> AI
#   providers sets and changes the same later.
param(
    [Parameter(Mandatory)][string[]]$Vaults,
    [string]$ReposRoot,
    [string]$SkillsPath,
    [string]$ClaudeToken,
    [switch]$ConnectCodex,
    [ValidateSet("claude-desktop", "codex-desktop")][string]$ChatApp,
    [switch]$SkipProviders
)

$ErrorActionPreference = "Stop"

$PowerLoomRoot = Split-Path -Parent $PSScriptRoot
$AgentToolsRoot = Split-Path -Parent $PowerLoomRoot
$EnvFile = Join-Path $PowerLoomRoot ".env"
$DatabaseVolume = "adoa_pgdata"
$BacklogVault = "powerloom-backlog"
$HealthAttempts = 60
$ClaudeSkills = Join-Path $HOME ".claude/skills"

function ConvertTo-HostPath([string]$path) {
    return [System.IO.Path]::GetFullPath($path).Replace('\', '/').TrimEnd('/')
}

# A folder compose mounts into the containers. A whole drive is refused: PowerLoom would get read-write access to all of
# it, and "E:" (the drive root without its slash) is read by compose as a relative folder (`E::/vaults`, "too many colons").
function ConvertTo-MountPath([string]$path, [string]$refusal) {
    $hostPath = ConvertTo-HostPath $path

    if (Test-DriveRoot $hostPath) {
        throw $refusal
    }

    return $hostPath
}

function Test-DriveRoot([string]$hostPath) {
    return $hostPath -match '^[A-Za-z]:$'
}

function Get-VaultsRoot([string[]]$paths) {
    $refusal = "The vaults are directly on a drive. PowerLoom mounts their parent folder into its containers, and a whole drive is too much: move them into a folder (e.g. E:/Vaults/<vault>) and pass those paths."
    $parents = @($paths | ForEach-Object { ConvertTo-MountPath (Split-Path -Parent $_) $refusal } | Sort-Object -Unique)

    if ($parents.Count -ne 1) {
        throw "The vaults must be folders of one parent folder (PowerLoom mounts one vaults root); got: $($parents -join ', ')."
    }

    return $parents[0]
}

# An .env from an earlier run keeps its vaults root; a vault outside it couldn't be mounted.
function Assert-VaultsRoot {
    $configured = Read-EnvValue "VAULTS_ROOT"

    if ($configured -ne $VaultsRoot) {
        throw "The vaults are in $VaultsRoot, but .env has VAULTS_ROOT=$configured. Change .env or pass vaults from $configured."
    }
}

function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker isn't installed: install Docker Desktop first."
    }

    docker info --format "{{.ServerVersion}}" | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Docker isn't running: start Docker Desktop and run this script again."
    }
}

function New-Secret {
    return -join ((1..24) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
}

function Get-ReposRoot {
    $refusal = "The repos folder can't be a whole drive (PowerLoom mounts it into its containers): pass -ReposRoot <folder with your repos>."

    if ($ReposRoot) {
        return ConvertTo-MountPath $ReposRoot $refusal
    }

    return ConvertTo-MountPath (Split-Path -Parent $AgentToolsRoot) $refusal
}

function Get-SkillsPath {
    if ($SkillsPath) {
        return ConvertTo-MountPath $SkillsPath "The skills folder can't be a whole drive (PowerLoom mounts it into its containers): pass -SkillsPath <folder>."
    }

    if (Test-Path $ClaudeSkills) {
        return ConvertTo-HostPath $ClaudeSkills
    }

    return ConvertTo-HostPath (Join-Path $PowerLoomRoot "local-skills")
}

# The PC's values for a new .env; everything else keeps the example's defaults.
function Get-InstallValues {
    return [ordered]@{
        POSTGRES_PASSWORD       = New-Secret
        VAULT_PATH              = "$VaultsRoot/$BacklogVault"
        VAULTS_ROOT             = $VaultsRoot
        SKILLS_PATH             = Get-SkillsPath
        REPOS_ROOT              = Get-ReposRoot
        AGENTTOOLS_PATH         = ConvertTo-HostPath $AgentToolsRoot
        MCP_TOKEN               = New-Secret
    }
}

# Replaces each key's whole line (the example's comment after a value goes with it); keeps the example's CRLF endings.
function Set-EnvValues {
    param(
        [Parameter(Mandatory)][string]$Text,
        [Parameter(Mandatory)][System.Collections.IDictionary]$Values
    )

    foreach ($key in $Values.Keys) {
        $Text = [regex]::Replace($Text, "(?m)^$key=[^\r\n]*", "$key=$($Values[$key])")
    }

    return $Text
}

function New-EnvFile {
    if (Test-Path $EnvFile) {
        Write-Host ".env exists: kept as it is."

        return
    }

    $example = Get-Content -Raw (Join-Path $PowerLoomRoot ".env.example")

    Set-Content -Path $EnvFile -Value (Set-EnvValues -Text $example -Values (Get-InstallValues)) -NoNewline
    Write-Host ".env written (database password and MCP token generated)."
}

function Read-EnvValue([string]$key) {
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^$key=" } | Select-Object -First 1

    return (($line -replace "^$key=", "") -replace "\s+#.*$", "").Trim()
}

# The compose file mounts these host folders; Docker would create missing ones owned by root. DevSecrets (DevHub) isn't
# part of this repository, so its skills folder stays empty.
function New-HostFolders {
    $folders = @(
        (Read-EnvValue "VAULTS_ROOT"),
        (Read-EnvValue "VAULT_PATH"),
        (Read-EnvValue "SKILLS_PATH"),
        (Read-EnvValue "REPOS_ROOT"),
        (Join-Path $AgentToolsRoot "DevSecrets/skills"),
        (Join-Path $PowerLoomRoot "backups"),
        (Join-Path $PowerLoomRoot "import-inbox"),
        (Join-Path $PowerLoomRoot "agent-homes/codex")
    )

    foreach ($folder in $folders) {
        New-Item -ItemType Directory -Force -Path $folder | Out-Null
    }
}

function New-DatabaseVolume {
    docker volume inspect $DatabaseVolume 2>$null | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database volume $DatabaseVolume exists: kept."

        return
    }

    docker volume create $DatabaseVolume | Out-Null
}

function Start-Stack {
    Push-Location $PowerLoomRoot

    try {
        docker compose up -d --build

        if ($LASTEXITCODE -ne 0) {
            throw "docker compose up failed."
        }
    }
    finally {
        Pop-Location
    }
}

# The API migrates the database at start; vaults can be added once it answers.
function Wait-Api([string]$api) {
    $attempt = 0

    do {
        $attempt++

        if (Test-Api $api) {
            return
        }

        Start-Sleep -Seconds 5
    } while ($attempt -lt $HealthAttempts)

    throw "PowerLoom's API didn't answer at $api/health; see docker compose logs powerloom."
}

function Test-Api([string]$api) {
    try {
        Invoke-RestMethod "$api/health" | Out-Null

        return $true
    }
    catch {
        return $false
    }
}

# Add vault prepares the folder from PowerLoom's templates and creates its vault review schedule; one added before is
# a conflict, which is fine here.
function Add-Vault([string]$api, [string]$path) {
    $body = @{ folder = $path } | ConvertTo-Json

    try {
        Invoke-RestMethod -Method Post -Uri "$api/api/vaults" -ContentType "application/json" -Body $body | Out-Null
        Write-Host "Vault $path added."
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 409) {
            Write-Host "Vault $path already exists: kept."
            return
        }

        throw "Vault ${path}: $($_.ErrorDetails.Message ?? $_.Exception.Message)"
    }
}

function Complete-Installation([string]$api, [string[]]$paths) {
    $failures = [Collections.Generic.List[string]]::new()
    foreach ($path in $paths) {
        try { Add-Vault $api $path }
        catch { $failures.Add($_.Exception.Message) }
    }

    if ($failures.Count) {
        throw "Required vault setup failed: $($failures -join '; '). Created resources were kept; correct the failures and rerun install.ps1."
    }

    Set-Providers $api
    Show-NextSteps
}

# Optional; a provider that can't be set up here (no token, Codex sign-in failed) is set in Settings later.
function Set-Providers([string]$api) {
    if ($SkipProviders) {
        return
    }

    $options = @{ Api = $api; ClaudeToken = $ClaudeToken; ConnectCodex = $ConnectCodex }

    if ($ChatApp) {
        $options.ChatApp = $ChatApp
    }

    & (Join-Path $PSScriptRoot "Set-AiProviders.ps1") @options
}

function Show-NextSteps {
    Write-Host ""
    Write-Host "PowerLoom runs: http://localhost:$(Read-EnvValue 'WEB_PORT')"
    Write-Host "Next: Settings -> AI providers: what you skipped above (agents run once their provider is connected)."
    Write-Host "      Settings -> per vault: Azure DevOps (org, project, team, user, token) and the features to switch on;"
    Write-Host "      'Configure with Claude' or 'Configure with Codex' on each vault (rules, hooks, the MCP server)."
}

$VaultPaths = @($Vaults | ForEach-Object { ConvertTo-HostPath $_ })
$VaultsRoot = Get-VaultsRoot $VaultPaths

Assert-Docker
New-EnvFile
& (Join-Path $PSScriptRoot 'Set-DesktopChatHistory.ps1')
Assert-VaultsRoot
New-HostFolders
New-DatabaseVolume
Start-Stack

$api = "http://127.0.0.1:$(Read-EnvValue 'POWERLOOM_PORT')"

Wait-Api $api

Complete-Installation $api $VaultPaths
