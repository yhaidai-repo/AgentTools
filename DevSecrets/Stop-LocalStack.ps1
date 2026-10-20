<#
.SYNOPSIS
    Stops the local stack started by Start-LocalStack.ps1: kills each service's process tree and the RabbitMQ container.
    Logs are kept.

.EXAMPLE
    ./Stop-LocalStack.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

. "$PSScriptRoot/DevSecrets.Common.ps1"
. "$PSScriptRoot/LocalStack.RabbitMq.ps1"
. "$PSScriptRoot/LocalStack.Redis.ps1"
. "$PSScriptRoot/LocalStack.Process.ps1"

$state = Read-StackState

if ($state) {
    Stop-Stack $state
}

# A start killed before it saved its state (e.g. DevHub's DELETE while starting) can leave the container behind.
if (Test-LocalRedisRunning) {
    Stop-LocalRedis
}

if (Test-LocalRabbitMqRunning) {
    Stop-LocalRabbitMq
}

if (-not $state) {
    Write-Host "No local stack state; nothing else to stop."

    return
}

Write-Host "Logs kept in $StackDir"
