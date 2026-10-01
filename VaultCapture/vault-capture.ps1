<#
.SYNOPSIS
    Agent-agnostic CLI for saving session findings into vault drafts.
.EXAMPLE
    pwsh -NoProfile -File vault-capture.ps1 rules
.EXAMPLE
    '{"vault":"work-projects","project":"pvs","name":"pvs-topic","title":"Topic","source":"session finding","target":"[[pvs-index]]","captured":["fact"]}' |
        pwsh -NoProfile -File vault-capture.ps1 capture
.EXAMPLE
    pwsh -NoProfile -File vault-capture.ps1 capture -InputFile capture.json
#>
param([string]$Command)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::InputEncoding = [Text.Encoding]::UTF8

Import-Module (Join-Path $PSScriptRoot 'VaultCapture.psd1') -Force
. (Join-Path $PSScriptRoot '..' 'VaultUsage' 'Cli' 'ConvertTo-ParameterTable.ps1')

function Invoke-RulesCommand {
    param([ValidateSet('text', 'json')][string]$Format = 'text')

    if ($Format -eq 'json') {
        return Get-VaultRules | ConvertTo-Json -Depth 5
    }

    return Get-CaptureInstruction
}

function Invoke-CaptureCommand {
    param([string]$InputFile)

    $json = if ($InputFile) { Get-Content -LiteralPath $InputFile -Raw } else { [Console]::In.ReadToEnd() }
    $result = Save-VaultCapture -InputObject ($json | ConvertFrom-Json)

    $result | ConvertTo-Json -Compress
    if (-not $result.ok) {
        exit 1
    }
}

$commands = @{
    rules   = 'Invoke-RulesCommand'
    capture = 'Invoke-CaptureCommand'
}

if (-not $commands.ContainsKey([string]$Command)) {
    throw "Unknown command '$Command'. Use: $($commands.Keys -join ', ')."
}

$parameters = ConvertTo-ParameterTable -Arguments $args

& $commands[$Command] @parameters
