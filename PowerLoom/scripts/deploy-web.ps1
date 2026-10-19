# Deploys a web change: rebuilds the shared app image and recreates only the web container. The agent-runner is
# recreated only with -WithRunner, and only while no agent run is in progress: recreating it kills a running run
# (WWW-010, 2026-10-19: a vault review was lost that way). -Force recreates it anyway.
param(
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

# The agent-runner service builds the image the web runs too; building doesn't touch a running container.
Invoke-Compose @("build", "agent-runner")
Invoke-Compose @("up", "-d", "--no-deps", "web")
Write-Host "web recreated."

if ($WithRunner) {
    Update-Runner $running
}
