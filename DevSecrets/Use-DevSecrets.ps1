<#
.SYNOPSIS
    Configures the local run of one or more services: writes their secrets and routes their calls to the
    other services you run locally, everything else to the remote (Azure dev) instances.

.DESCRIPTION
    Files next to this script (no secrets, may be in git):
      services.json        runnable services: local URL, local API key, projects
      map.json             per project: config key -> value name, or a routing reference
    Secret values, outside git (D:/Projects/dev-secrets or $env:DEV_SECRETS_VALUES_DIR):
      values.<name>.json   named values; "$extends" lets a file list only what differs

    Routing references in map.json:
      @patients.url|patients-remote-url   local URL of patients when it runs locally, else the named value
      @patients.key|signals-patient-key   local API key of patients when it runs locally, else the named value
      @patients.key                       always the local key (the service's own inbound key)

    Mapped keys are overwritten in each project's user secrets; other keys (e.g. Aspire's) are kept.
    The first write saves the old file as secrets.json.bak. Values are never printed.

.EXAMPLE
    ./Use-DevSecrets.ps1 -Local signals
    Signals runs locally; patients, verifications, storage, ... are remote.

.EXAMPLE
    ./Use-DevSecrets.ps1 -Local signals,verifications
    Signals calls the local Verifications API; the rest stays remote.

.EXAMPLE
    ./Use-DevSecrets.ps1 -Local signals,patients -DryRun
#>
[CmdletBinding()]
param(
    [string[]] $Local = @(),

    [string] $Values = "remote",

    [string] $Project,

    [switch] $All,

    [switch] $DryRun
)

$ErrorActionPreference = "Stop"

$StoreDir = $PSScriptRoot
# Secret values stay outside any git repo; override with DEV_SECRETS_VALUES_DIR.
$ValuesDir = if ($env:DEV_SECRETS_VALUES_DIR) { $env:DEV_SECRETS_VALUES_DIR } else { "D:/Projects/dev-secrets" }
$PropsPath = "D:/Projects/Directory.Build.props"
$MaxExtendsDepth = 5
$Placeholder = "<fill-me>"
$ReferencePattern = '^@(?<service>[a-z0-9-]+)\.(?<part>url|key)(\|(?<remote>.+))?$'

function Read-JsonFile([string] $Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path"
    }

    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json -AsHashtable
}

function Get-ValuesChain([string] $Name) {
    $chain = [System.Collections.Generic.List[hashtable]]::new()
    $next = $Name

    do {
        $fileValues = Read-JsonFile (Join-Path $ValuesDir "values.$next.json")
        $chain.Insert(0, $fileValues)
        $next = $fileValues['$extends']
    } while ($next -and $chain.Count -lt $MaxExtendsDepth)

    if ($next) {
        throw "Values '$Name' extends more than $MaxExtendsDepth levels deep."
    }

    return $chain
}

function Read-NamedValues([string] $Name) {
    $named = @{}

    foreach ($fileValues in Get-ValuesChain $Name) {
        $fileValues.GetEnumerator() | Where-Object Key -ne '$extends' | ForEach-Object { $named[$_.Key] = $_.Value }
    }

    return $named
}

function Get-LocalServices([string[]] $Names) {
    return @($Names | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
}

function Resolve-ProjectPath([hashtable] $Repos, [string] $ProjectKey) {
    $repo, $relative = $ProjectKey -split '/', 2

    return Join-Path $Repos[$repo] $relative
}

function Get-UserSecretsId([string] $ProjectPath) {
    $inProject = Select-String -LiteralPath $ProjectPath -Pattern '<UserSecretsId>([^<]+)</UserSecretsId>' | Select-Object -First 1

    if ($inProject) {
        return $inProject.Matches[0].Groups[1].Value
    }

    $projectName = [System.IO.Path]::GetFileNameWithoutExtension($ProjectPath)
    $pattern = "== '$([regex]::Escape($projectName))'`">\s*<UserSecretsId>([^<]+)</UserSecretsId>"
    $inProps = [regex]::Match((Get-Content -Raw -LiteralPath $PropsPath), $pattern)

    return $(if ($inProps.Success) { $inProps.Groups[1].Value } else { $null })
}

function Resolve-Reference([string] $Reference, [hashtable] $Named) {
    $match = [regex]::Match($Reference, $ReferencePattern)
    $serviceName = $match.Groups['service'].Value
    $service = $Services[$serviceName]
    $part = $match.Groups['part'].Value
    $remote = $match.Groups['remote'].Value

    if ($LocalServices -contains $serviceName -or -not $remote) {
        return $(if ($part -eq 'url') { $service.localUrl } else { $service.localKey })
    }

    return $Named[$remote]
}

function Resolve-MappedValue([string] $ValueName, [hashtable] $Named) {
    if ($ValueName.StartsWith('@')) {
        return Resolve-Reference $ValueName $Named
    }

    return $Named[$ValueName]
}

function Test-ValidReference([string] $ValueName) {
    $match = [regex]::Match($ValueName, $ReferencePattern)

    return $match.Success -and $Services.ContainsKey($match.Groups['service'].Value)
}

function Get-ReferenceErrors([string] $ProjectKey, [hashtable] $Mapping) {
    return $Mapping.GetEnumerator() |
        Where-Object { $_.Value.StartsWith('@') -and -not (Test-ValidReference $_.Value) } |
        ForEach-Object { "${ProjectKey}: '$($_.Key)' has an invalid reference '$($_.Value)'" }
}

function Test-ResolvesToNothing([string] $ValueName, [hashtable] $Named) {
    $resolved = Resolve-MappedValue $ValueName $Named

    return [string]::IsNullOrWhiteSpace($resolved) -or $resolved -eq $Placeholder
}

function Get-MissingValueErrors([string] $ProjectKey, [hashtable] $Mapping, [hashtable] $Named) {
    return $Mapping.GetEnumerator() |
        Where-Object { Test-ResolvesToNothing $_.Value $Named } |
        ForEach-Object { "${ProjectKey}: '$($_.Key)' -> '$($_.Value)' resolves to nothing" }
}

function Get-ProjectErrors([string] $ProjectKey, [hashtable] $Mapping, [hashtable] $Named) {
    $projectPath = Resolve-ProjectPath $Store.repos $ProjectKey

    if (-not (Test-Path -LiteralPath $projectPath)) {
        return @("${ProjectKey}: project file not found at $projectPath")
    }

    if (-not (Get-UserSecretsId $projectPath)) {
        return @("${ProjectKey}: no UserSecretsId (add it to the project or to $PropsPath)")
    }

    $referenceErrors = @(Get-ReferenceErrors $ProjectKey $Mapping)

    if ($referenceErrors.Count -gt 0) {
        return $referenceErrors
    }

    return @(Get-MissingValueErrors $ProjectKey $Mapping $Named)
}

function Get-SelectedProjects() {
    if ($All) {
        return @($Store.projects.Keys)
    }

    if ($Project) {
        return @($Store.projects.Keys | Where-Object { $_ -like $Project })
    }

    return @($LocalServices | ForEach-Object { $Services[$_].projects } | Select-Object -Unique)
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

function Get-RouteTarget([string] $ValueName) {
    $match = [regex]::Match($ValueName, $ReferencePattern)

    if (-not $match.Success -or -not $match.Groups['remote'].Success) {
        return $null
    }

    $serviceName = $match.Groups['service'].Value

    return $serviceName + $(if ($LocalServices -contains $serviceName) { '=local' } else { '=remote' })
}

function Format-Routes([hashtable] $Mapping) {
    $routes = @($Mapping.Values | ForEach-Object { Get-RouteTarget $_ } | Where-Object { $_ } | Select-Object -Unique | Sort-Object)

    return $(if ($routes.Count -gt 0) { " [calls: $($routes -join ', ')]" } else { "" })
}

function Write-ProjectSecrets([string] $ProjectKey, [hashtable] $Mapping, [hashtable] $Named) {
    $secretsId = Get-UserSecretsId (Resolve-ProjectPath $Store.repos $ProjectKey)
    $secretsPath = Join-Path $env:APPDATA "Microsoft/UserSecrets/$secretsId/secrets.json"
    $secrets = Read-UnmappedSecrets $secretsPath $Mapping
    $kept = $secrets.Count

    $Mapping.GetEnumerator() | Sort-Object Key | ForEach-Object { $secrets[$_.Key] = Resolve-MappedValue $_.Value $Named }

    $summary = "${ProjectKey}: $($Mapping.Count) keys, $kept others kept$(Format-Routes $Mapping)"

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

$Store = Read-JsonFile (Join-Path $StoreDir "map.json")
$Services = Read-JsonFile (Join-Path $StoreDir "services.json")
$LocalServices = Get-LocalServices $Local
$named = Read-NamedValues $Values

$unknown = @($LocalServices | Where-Object { -not $Services.ContainsKey($_) })

if ($unknown.Count -gt 0) {
    throw "Unknown service(s): $($unknown -join ', '). Known: $(($Services.Keys | Sort-Object) -join ', ')"
}

$selected = @(Get-SelectedProjects | Sort-Object)

if ($selected.Count -eq 0) {
    throw "No project selected: pass -Local <services>, -Project <pattern> or -All."
}

$errors = @($selected | ForEach-Object { Get-ProjectErrors $_ $Store.projects[$_] $named })

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ -ErrorAction Continue }

    throw "Nothing was written: fix the $($errors.Count) problem(s) above."
}

Write-Host "Local: $(if ($LocalServices) { $LocalServices -join ', ' } else { '(none)' }); values: $Values"
$LocalServices | Where-Object { $Services[$_].localUrl } | ForEach-Object { Write-Host "  $_ expected at $($Services[$_].localUrl)" }

$selected | ForEach-Object { Write-ProjectSecrets $_ $Store.projects[$_] $named }
