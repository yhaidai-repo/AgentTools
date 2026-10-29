<#
.SYNOPSIS
    Shows the local stack started by Start-LocalStack.ps1: each service, whether it still runs, its URL and log.

.EXAMPLE
    ./Get-LocalStack.ps1

.EXAMPLE
    ./Get-LocalStack.ps1 -Json
#>
[CmdletBinding()]
param(
    [switch] $Json
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot/DevSecrets.Common.ps1"
. "$PSScriptRoot/LocalStack.RabbitMq.ps1"
. "$PSScriptRoot/LocalStack.Redis.ps1"
. "$PSScriptRoot/LocalStack.Process.ps1"
. "$PSScriptRoot/LocalStack.Identity.ps1"

function Get-EntryStatus([hashtable] $Entry) {
    return [ordered]@{
        name = $Entry.name
        running = Test-EntryAlive $Entry
        url = $Entry.url
        log = $Entry.log
        errorLog = $Entry.errorLog
        workers = $Entry.config?.workers
    }
}

$state = (Read-StackState) ?? @{ services = @() }
$currentIdentity = @{}
if ($state.buildRoots -and $state.buildIdentity) {
    try {
        $current = Get-StackBuildIdentity $state.buildRoots $(if ($state.strictBranch) { $state.branch } else { $null })
        if (($current | ConvertTo-Json -Compress) -eq ($state.buildIdentity | ConvertTo-Json -Compress)) { $currentIdentity = $state.buildIdentity }
    } catch { $currentIdentity = @{} }
}
$status = [ordered]@{
    running = $state.services.Count -gt 0
    branch = $state.branch
    buildIdentity = $currentIdentity
    strictBranch = [bool]$state.strictBranch
    environment = $state.environment
    services = @($state.services | ForEach-Object { Get-EntryStatus $_ })
}

if ($Json) {
    $status | ConvertTo-Json -Depth 4

    return
}

if (-not $status.running) {
    Write-Host "No local stack is running."

    return
}

Write-Host "Local stack$(if ($state.branch) { " (branch $($state.branch))" }):"
$status.services | ForEach-Object { Write-Host "  $($_.name): $(if ($_.running) { 'running' } else { 'STOPPED' })$(if ($_.url) { " $($_.url)" }) log $($_.log)" }
