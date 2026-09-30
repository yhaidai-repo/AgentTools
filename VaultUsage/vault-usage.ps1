<#
.SYNOPSIS
    Agent-agnostic CLI for vault usage tracking.
.EXAMPLE
    pwsh -NoProfile -File vault-usage.ps1 record -Path D:/Claude/work-projects/index.md -Kind read -Agent codex -Session 42
.EXAMPLE
    pwsh -NoProfile -File vault-usage.ps1 report -Vault D:/Claude/work-projects -Since 2026-09-01 -Format markdown
#>
param([string]$Command)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

Import-Module (Join-Path $PSScriptRoot 'VaultUsage.psd1') -Force
. (Join-Path $PSScriptRoot 'Cli' 'ConvertTo-ParameterTable.ps1')

$commands = @{
    record = 'Add-VaultUsage'
    report = 'Get-VaultUsageReport'
}

if (-not $commands.ContainsKey([string]$Command)) {
    throw "Unknown command '$Command'. Use: $($commands.Keys -join ', ')."
}

$parameters = ConvertTo-ParameterTable -Arguments $args
$result = & $commands[$Command] @parameters

if ($Command -eq 'record') {
    $result | ForEach-Object { $_ | ConvertTo-Json -Compress }
}
else {
    $result
}
