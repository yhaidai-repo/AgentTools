<#
.SYNOPSIS
    Configures the local run of one or more services: writes their secrets and routes their calls to the
    other services you run locally, everything else to the remote (Azure dev) instances.

.DESCRIPTION
    Files next to this script (no secrets, may be in git):
      services.json        runnable services: projects, how to run them
      map.json             per project: config key -> value name, or a call to an app
    Secret values, outside git (D:/Projects/dev-secrets or $env:DEV_SECRETS_VALUES_DIR), one file per environment:
      values.<env>.json    named values (dev, local, ...); "$extends" lets a file list only what differs

    Calls in map.json read the app's link, a named value:
      @patients.url        "patients-url" from values.local.json while patients runs locally, else from -Values
      @vapi.url-2          "vapi-url-2": an app's second address
      @patients.key        in a project of patients itself: always values.local.json (its own inbound key)

    Mapped keys are overwritten in each project's user secrets; other keys (e.g. Aspire's) are kept.
    The first write saves the old file as secrets.json.bak. Values are never printed.
    Start-LocalStack.ps1 uses the same resolution but passes the values as environment variables.

.EXAMPLE
    ./Use-DevSecrets.ps1 -Local signals
    Signals runs locally; patients, verifications, storage, ... are remote.

.EXAMPLE
    ./Use-DevSecrets.ps1 -Local signals,verifications
    Signals calls the local Verifications API; the rest stays remote.

.EXAMPLE
    ./Use-DevSecrets.ps1 -Local signals,patients -DryRun

.EXAMPLE
    ./Use-DevSecrets.ps1 -All -Check
    Validates every project and prints the problems as JSON (DevHub's UI); writes nothing.
#>
[CmdletBinding()]
param(
    [string[]] $Local = @(),

    [string] $Values = "dev",

    [string] $Project,

    [switch] $All,

    [switch] $DryRun,

    [switch] $Check
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot/DevSecrets.Common.ps1"
. "$PSScriptRoot/DevSecrets.Resolve.ps1"

function Get-SelectedProjects() {
    if ($All) {
        return @($Store.projects.Keys)
    }

    if ($Project) {
        return @($Store.projects.Keys | Where-Object { $_ -like $Project })
    }

    return @($LocalServices | ForEach-Object { $Catalog[$_].projects } | Select-Object -Unique)
}

function Read-UnmappedSecrets([string] $SecretsPath, [hashtable] $Mapping) {
    $kept = [ordered]@{}

    if (-not (Test-Path -LiteralPath $SecretsPath)) {
        return $kept
    }

    $existing = Read-JsonFile $SecretsPath
    $existing.GetEnumerator() | Where-Object { -not $Mapping.ContainsKey($_.Key) } | Sort-Object Key | ForEach-Object { $kept[$_.Key] = $_.Value }

    return $kept
}

function Backup-SecretsOnce([string] $SecretsPath) {
    $backupPath = "$SecretsPath.bak"

    if ((Test-Path -LiteralPath $SecretsPath) -and -not (Test-Path -LiteralPath $backupPath)) {
        Copy-Item -LiteralPath $SecretsPath -Destination $backupPath
    }
}

function Write-ProjectSecrets([string] $ProjectKey, [hashtable] $Named) {
    $mapping = $Store.projects[$ProjectKey]
    $secretsId = Get-UserSecretsId (Resolve-ProjectPath $Store.repos $ProjectKey)
    $secretsPath = Join-Path $env:APPDATA "Microsoft/UserSecrets/$secretsId/secrets.json"
    $secrets = Read-UnmappedSecrets $secretsPath $mapping
    $kept = $secrets.Count

    (Resolve-ProjectConfig $ProjectKey $Named).GetEnumerator() | ForEach-Object { $secrets[$_.Key] = $_.Value }

    $summary = "${ProjectKey}: $($mapping.Count) keys, $kept others kept$(Format-Routes $mapping $ProjectKey)"

    if ($DryRun) {
        Write-Host "[dry-run] $summary"

        return
    }

    New-Item -ItemType Directory -Force -Path (Split-Path $secretsPath) | Out-Null
    Backup-SecretsOnce $secretsPath

    $tempPath = "$secretsPath.tmp"
    $secrets | ConvertTo-Json | Set-Content -LiteralPath $tempPath -Encoding utf8NoBOM
    Move-Item -LiteralPath $tempPath -Destination $secretsPath -Force

    Write-Host $summary
}

$Store = Read-Store
$Catalog = Read-Services
Initialize-LocalValues
$LocalServices = Get-ServiceNames $Local
$named = Read-NamedValues $Values

Assert-KnownServices $Catalog $LocalServices

$selected = @(Get-SelectedProjects | Sort-Object)

if ($selected.Count -eq 0) {
    throw "No project selected: pass -Local <services>, -Project <pattern> or -All."
}

$errors = @($selected | ForEach-Object { Get-ProjectErrors $Store.repos $_ $named $true })

if ($Check) {
    ConvertTo-Json -InputObject @{ values = $Values; problems = $errors } -Depth 3

    return
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ -ErrorAction Continue }

    throw "Nothing was written: fix the $($errors.Count) problem(s) above."
}

Write-Host "Local: $(if ($LocalServices) { $LocalServices -join ', ' } else { '(none)' }); values: $Values"
$LocalServices | Where-Object { Get-LocalUrl $_ } | ForEach-Object { Write-Host "  $_ expected at $(Get-LocalUrl $_)" }

$selected | ForEach-Object { Write-ProjectSecrets $_ $named }
