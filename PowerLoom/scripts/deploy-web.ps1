# Deploys a web change: rebuilds the shared app image and recreates only the web container. The agent-runner is
# recreated only with -WithRunner, and only while no agent run is in progress: recreating it kills a running run
# (WWW-010, 2026-10-19: a vault review was lost that way). -Force recreates it anyway.
# -WithApi also rebuilds and recreates PowerLoom's API (it migrates the database at start), under the same guard, since
# a run in progress reports its end to it; it goes first, so a new web and runner find the migrated schema.
param(
    [switch]$WithApi,
    [switch]$WithRunner,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$RunningRunsSql = "select id || ' ' || stage || ' ' || coalesce(item_id, '-') || ' since ' || to_char(started_at, 'HH24:MI') from agent_run where outcome = 'running' order by id"

function Get-RunningRuns {
    $rows = $RunningRunsSql | docker exec -i powerloom-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'

    if ($LASTEXITCODE -ne 0) {
        throw "Could not read the runs in progress from the database."
    }

    return @($rows | Where-Object { $_ })
}

function Show-RunningRuns([string[]]$runs) {
    if ($runs.Count -eq 0) {
        Write-Host "No agent run in progress."

        return
    }

    Write-Host "Agent runs in progress:"
    $runs | ForEach-Object { Write-Host "  RUN-$_" }
}

function Invoke-Compose([string[]]$arguments) {
    docker compose @arguments

    if ($LASTEXITCODE -ne 0) {
        throw "docker compose $($arguments -join ' ') failed."
    }
}

function Update-Api([string[]]$runs) {
    if ($runs.Count -gt 0 -and -not $Force) {
        throw "PowerLoom's API was NOT recreated: the runs above report their end to it. Wait for them, or pass -Force."
    }

    Invoke-Compose @("build", "powerloom")
    Invoke-Compose @("up", "-d", "--no-deps", "--wait", "powerloom")
    Write-Host "PowerLoom API recreated (database migrated)."
}

function Update-Runner([string[]]$runs) {
    if ($runs.Count -gt 0 -and -not $Force) {
        Write-Host "The agent-runner was NOT recreated: it would kill the runs above. Wait for them, or pass -Force."

        return
    }

    Invoke-Compose @("up", "-d", "--no-deps", "agent-runner")
    Write-Host "agent-runner recreated."
}

Set-Location (Join-Path $PSScriptRoot "..")
$running = Get-RunningRuns
Show-RunningRuns $running

if ($WithApi) {
    Update-Api $running
}

# The agent-runner service builds the image the web runs too; building doesn't touch a running container.
Invoke-Compose @("build", "agent-runner")
Invoke-Compose @("up", "-d", "--no-deps", "web")
Write-Host "web recreated."

if ($WithRunner) {
    Update-Runner $running
}
