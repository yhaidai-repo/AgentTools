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
    pwsh -NoProfile -File vault-capture.ps1 drafts -Vault work-projects -PreferSource "session finding: powerloom"
.EXAMPLE
    pwsh -NoProfile -File vault-capture.ps1 is-draft -Vault work-projects -Name pvs-topic -Name pvs-other
#>
param([string]$Command)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::InputEncoding = [Text.Encoding]::UTF8

Import-Module (Join-Path $PSScriptRoot 'VaultCapture.psd1') -Force

# -VaultRoot <path> on any command names the vault to work in (2026-10-06): no configuration needed, several with ";".
function Use-VaultRoot {
    param([string]$VaultRoot)

    if ($VaultRoot) {
        $env:VAULT_CAPTURE_VAULTS = if ($env:VAULT_CAPTURE_VAULTS) { "$($env:VAULT_CAPTURE_VAULTS);$VaultRoot" } else { $VaultRoot }
    }
}
. (Join-Path $PSScriptRoot 'Cli' 'ConvertTo-ParameterTable.ps1')

# The caller's working directory decides the project it captures into, so -Cwd defaults to where the command runs.
function Invoke-RulesCommand {
    param(
        [ValidateSet('text', 'json')][string]$Format = 'text',
        [string]$Cwd = (Get-Location -PSProvider FileSystem).ProviderPath,
        [string]$VaultRoot
    )

    Use-VaultRoot -VaultRoot $VaultRoot

    if ($Format -eq 'json') {
        return Get-VaultRules -Cwd $Cwd | ConvertTo-Json -Depth 5
    }

    return Get-CaptureInstruction -Cwd $Cwd
}

function Invoke-CaptureCommand {
    param(
        [string]$InputFile,
        [string]$Cwd = (Get-Location -PSProvider FileSystem).ProviderPath,
        [string]$VaultRoot
    )

    Use-VaultRoot -VaultRoot $VaultRoot

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
        [string]$PreferSource,
        [string]$VaultRoot
    )

    Use-VaultRoot -VaultRoot $VaultRoot

    Write-QueryResult -Result (Get-VaultDraft -Vault $Vault -PreferSource $PreferSource)
}

# -Name repeats: is-draft -Vault work-projects -Name pvs-a -Name pvs-b
function Invoke-IsDraftCommand {
    param(
        [Parameter(Mandatory)][string]$Vault,
        [Parameter(Mandatory)][string[]]$Name,
        [string]$VaultRoot
    )

    Use-VaultRoot -VaultRoot $VaultRoot

    Write-QueryResult -Result (Test-VaultDraft -Vault $Vault -Name $Name)
}

# The records of a project's register: register -Vault work-projects -Project pvs -Kind questions|issues
function Invoke-RegisterCommand {
    param(
        [Parameter(Mandatory)][string]$Vault,
        [Parameter(Mandatory)][string]$Project,
        [Parameter(Mandatory)][string]$Kind,
        [string]$VaultRoot
    )

    Use-VaultRoot -VaultRoot $VaultRoot

    Write-QueryResult -Result (Get-VaultRegister -Vault $Vault -Project $Project -Kind $Kind)
}

# A new record, JSON on stdin (or -InputFile): {"vault","project","kind":"questions|issues","title","text","default":[],"options":[]}
function Invoke-RegisterAddCommand {
    param([string]$InputFile,
        [string]$VaultRoot
    )

    Use-VaultRoot -VaultRoot $VaultRoot

    $json = if ($InputFile) { Get-Content -LiteralPath $InputFile -Raw } else { [Console]::In.ReadToEnd() }

    Write-QueryResult -Result (Add-VaultRegisterRecord -InputObject ($json | ConvertFrom-Json))
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
    register   = 'Invoke-RegisterCommand'
    'register-add' = 'Invoke-RegisterAddCommand'
}

if (-not $commands.ContainsKey([string]$Command)) {
    throw "Unknown command '$Command'. Use: $($commands.Keys -join ', ')."
}

$parameters = ConvertTo-ParameterTable -Arguments $args

& $commands[$Command] @parameters
