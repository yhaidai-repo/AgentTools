<#
.SYNOPSIS
    Runs the stack bridge: a small HTTP API on this machine through which PowerLoom's agents (in Docker) start,
    inspect and stop local stacks (Start-/Get-/Stop-LocalStack.ps1).

.DESCRIPTION
    Listens on 127.0.0.1 only; containers reach it as http://host.docker.internal:<port>.
    Every call except /health needs "Authorization: Bearer <token>", the dev-secrets value "stack-bridge-token"
    (created on the first run; never printed).
    A stack stops when its time is up (ttlMinutes, default 60) and when the bridge stops (Ctrl+C).

    GET    /services                    runnable services
    POST   /stack {services, branch?, ttlMinutes?}   start (202); GET /stack until phase is ready or failed
    GET    /stack                       phase, services, start output
    GET    /stack/logs/{service}?lines=200&error=false
    DELETE /stack                       stop

.EXAMPLE
    ./Start-StackBridge.ps1
#>
[CmdletBinding()]
param(
    [int] $Port = 47811
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot/DevSecrets.Common.ps1"

$TokenValue = "stack-bridge-token"
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

function Get-BridgeToken() {
    $valuesPath = Join-Path $ValuesDir "values.remote.json"

    if (-not (Read-JsonFile $valuesPath).ContainsKey($TokenValue)) {
        Add-TokenValue $valuesPath
    }

    return (Read-JsonFile $valuesPath)[$TokenValue]
}

$env:StackBridge__Token = Get-BridgeToken
$env:StackBridge__ScriptsDir = $PSScriptRoot
$env:StackBridge__ValuesDir = $ValuesDir
$env:ASPNETCORE_URLS = "http://127.0.0.1:$Port"

Write-Host "Stack bridge on http://127.0.0.1:$Port (containers: http://host.docker.internal:$Port). Ctrl+C stops it and its stack."
dotnet run --project (Join-Path $PSScriptRoot "StackBridge/StackBridge.csproj") -c Release
