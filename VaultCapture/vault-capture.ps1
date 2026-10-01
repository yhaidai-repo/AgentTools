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
.EXAMPLE
    pwsh -NoProfile -File vault-capture.ps1 drafts -Vault work-projects -PreferSource "session finding: adoa"
.EXAMPLE
    pwsh -NoProfile -File vault-capture.ps1 is-draft -Vault work-projects -Name pvs-topic -Name pvs-other
#>
param([string]$Command)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::InputEncoding = [Text.Encoding]::UTF8

Import-Module (Join-Path $PSScriptRoot 'VaultCapture.psd1') -Force
. (Join-Path $PSScriptRoot 'Cli' 'ConvertTo-ParameterTable.ps1')

# The caller's working directory decides the project it captures into, so -Cwd defaults to where the command runs.
function Invoke-RulesCommand {
    param(
        [ValidateSet('text', 'json')][string]$Format = 'text',
        [string]$Cwd = (Get-Location -PSProvider FileSystem).ProviderPath
    )

    if ($Format -eq 'json') {
        return Get-VaultRules -Cwd $Cwd | ConvertTo-Json -Depth 5
    }

    return Get-CaptureInstruction -Cwd $Cwd
}

function Invoke-CaptureCommand {
    param(
        [string]$InputFile,
        [string]$Cwd = (Get-Location -PSProvider FileSystem).ProviderPath
    )

    $json = if ($InputFile) { Get-Content -LiteralPath $InputFile -Raw } else { [Console]::In.ReadToEnd() }
    $result = Save-VaultCapture -InputObject ($json | ConvertFrom-Json) -Cwd $Cwd

    $result | ConvertTo-Json -Compress
    if (-not $result.ok) {
        exit 1
    }
}

# Drafts for a writer to verify and merge; -PreferSource puts e.g. a pipeline's drafts first.
function Invoke-DraftsCommand {
    param(
        [Parameter(Mandatory)][string]$Vault,
        [string]$PreferSource
    )

    Write-QueryResult -Result (Get-VaultDraft -Vault $Vault -PreferSource $PreferSource)
}

# -Name repeats: is-draft -Vault work-projects -Name pvs-a -Name pvs-b
function Invoke-IsDraftCommand {
    param(
        [Parameter(Mandatory)][string]$Vault,
        [Parameter(Mandatory)][string[]]$Name
    )

    Write-QueryResult -Result (Test-VaultDraft -Vault $Vault -Name $Name)
}

function Write-QueryResult {
    param([Parameter(Mandatory)][object]$Result)

    $Result | ConvertTo-Json -Compress -Depth 5
    if (-not $Result.ok) {
        exit 1
    }
}

$commands = @{
    rules      = 'Invoke-RulesCommand'
    capture    = 'Invoke-CaptureCommand'
    drafts     = 'Invoke-DraftsCommand'
    'is-draft' = 'Invoke-IsDraftCommand'
}

if (-not $commands.ContainsKey([string]$Command)) {
    throw "Unknown command '$Command'. Use: $($commands.Keys -join ', ')."
}

$parameters = ConvertTo-ParameterTable -Arguments $args

& $commands[$Command] @parameters
