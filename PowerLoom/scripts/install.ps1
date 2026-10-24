# First installation of PowerLoom on a Windows PC with Docker Desktop (user decision 2026-10-24). Safe to run again:
# every step keeps what is already there (.env, folders, the database volume, vaults).
# The agents and their prompts need no step: the agent-runner adds every built-in agent with the prompt files shipped in
# the code when it starts. Each vault added here gets the vault review schedule (every 6 hours) from Add vault.
#
#   pwsh scripts/install.ps1 -Vaults work-projects,personal-projects
#
# The Claude token comes from $env:CLAUDE_CODE_OAUTH_TOKEN, or is asked once (`claude setup-token` prints one).
param(
    [string]$VaultsRoot = "D:/Claude",
    [string]$ReposRoot = "D:/Projects",
    [string[]]$Vaults = @()
)

$ErrorActionPreference = "Stop"

$PowerLoomRoot = Split-Path -Parent $PSScriptRoot
$AgentToolsRoot = Split-Path -Parent $PowerLoomRoot
$EnvFile = Join-Path $PowerLoomRoot ".env"
$DatabaseVolume = "adoa_pgdata"
$BacklogVault = "powerloom-backlog"
$HealthAttempts = 60

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

function Get-ClaudeToken {
    if ($env:CLAUDE_CODE_OAUTH_TOKEN) {
        return $env:CLAUDE_CODE_OAUTH_TOKEN
    }

    $secure = Read-Host "Claude token (claude setup-token)" -AsSecureString

    return [System.Net.NetworkCredential]::new("", $secure).Password
}

# The PC's values for a new .env; everything else keeps the example's defaults.
function Get-InstallValues {
    return [ordered]@{
        POSTGRES_PASSWORD       = New-Secret
        VAULT_PATH              = "$VaultsRoot/$BacklogVault"
        VAULTS_ROOT             = $VaultsRoot
        SKILLS_PATH             = "$($HOME -replace '\\', '/')/.claude/skills"
        REPOS_ROOT              = $ReposRoot
        AGENTTOOLS_PATH         = $AgentToolsRoot -replace '\\', '/'
        CLAUDE_CODE_OAUTH_TOKEN = Get-ClaudeToken
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
        (Join-Path $AgentToolsRoot "DevSecrets/skills"),
        (Join-Path $PowerLoomRoot "backups"),
        (Join-Path $PowerLoomRoot "import-inbox")
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
function Add-Vault([string]$api, [string]$vault) {
    $body = @{ folder = "$(Read-EnvValue 'VAULTS_ROOT')/$vault" } | ConvertTo-Json

    try {
        Invoke-RestMethod -Method Post -Uri "$api/api/vaults" -ContentType "application/json" -Body $body | Out-Null
        Write-Host "Vault $vault added."
    }
    catch {
        Write-Host "Vault ${vault}: $($_.ErrorDetails.Message ?? $_.Exception.Message)"
    }
}

function Show-NextSteps {
    Write-Host ""
    Write-Host "PowerLoom runs: http://localhost:$(Read-EnvValue 'WEB_PORT')"
    Write-Host "Next: Settings -> per vault: Azure DevOps (org, project, team, user, token) and the features to switch on;"
    Write-Host "      'Configure with Claude' on each vault (CLAUDE.md, the VaultUsage/VaultCapture hooks, the MCP server)."
}

Assert-Docker
New-EnvFile
New-HostFolders
New-DatabaseVolume
Start-Stack

$api = "http://127.0.0.1:$(Read-EnvValue 'POWERLOOM_PORT')"

Wait-Api $api

foreach ($vault in $Vaults) {
    Add-Vault $api $vault
}

Show-NextSteps
