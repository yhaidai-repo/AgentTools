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
. "$PSScriptRoot/LocalStack.Process.ps1"

$state = Read-StackState

if (-not $state) {
    Write-Host "No local stack is running."

    return
}

Stop-Stack $state
Write-Host "Logs kept in $StackDir"
