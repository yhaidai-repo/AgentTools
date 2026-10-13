# Resolves the configuration of a project from map.json, services.json and the named values (dot-sourced).
# The caller sets $Store (map.json), $Catalog (services.json) and $LocalServices (names run locally), then calls
# Initialize-LocalValues.
#
# Every link to an app is a named value per environment (user decision 2026-10-14): "@patients.url" reads
# "patients-url", "@vapi.url-2" reads "vapi-url-2". It comes from values.local.json while the app runs in the stack (or
# is the project's own app: its inbound key), else from the stack's environment (values.dev.json, ...).

$Placeholder = "<fill-me>"
$LocalValuesName = "local"
$ReferencePattern = '^@(?<service>[a-z0-9-]+)\.(?<part>url|key|user)(?<instance>-[0-9]+)?$'
$MaxExtendsDepth = 5

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

function Initialize-LocalValues() {
    $script:LocalNamed = Read-NamedValues $LocalValuesName
    $script:AppOfProject = Get-AppOfProject
}

function Get-AppOfProject() {
    $apps = @{}

    foreach ($app in $Catalog.GetEnumerator()) {
        $app.Value.projects | ForEach-Object { $apps[$_] = $app.Key }
    }

    return $apps
}

# Where an app answers when it runs on this PC (readiness checks, port checks, the UI).
function Get-LocalUrl([string] $ServiceName) {
    return $LocalNamed["$ServiceName-url"]
}

function Get-EndpointName([System.Text.RegularExpressions.Match] $Match) {
    return "$($Match.Groups['service'].Value)-$($Match.Groups['part'].Value)$($Match.Groups['instance'].Value)"
}

function Test-LocalCall([string] $ServiceName, [string] $ProjectKey) {
    return $LocalServices -contains $ServiceName -or $AppOfProject[$ProjectKey] -eq $ServiceName
}

function Resolve-Reference([string] $Reference, [hashtable] $Named, [string] $ProjectKey) {
    $match = [regex]::Match($Reference, $ReferencePattern)
    $values = if (Test-LocalCall $match.Groups['service'].Value $ProjectKey) { $LocalNamed } else { $Named }

    return $values[(Get-EndpointName $match)]
}

function Resolve-MappedValue([string] $ValueName, [hashtable] $Named, [string] $ProjectKey) {
    if ($ValueName.StartsWith('@')) {
        return Resolve-Reference $ValueName $Named $ProjectKey
    }

    return $Named[$ValueName]
}

function Resolve-ProjectConfig([string] $ProjectKey, [hashtable] $Named) {
    $config = [ordered]@{}

    $Store.projects[$ProjectKey].GetEnumerator() | Sort-Object Key | ForEach-Object { $config[$_.Key] = Resolve-MappedValue $_.Value $Named $ProjectKey }

    return $config
}

function ConvertTo-EnvironmentName([string] $ConfigKey) {
    # .NET reads "A__B" from the environment as the configuration key "A:B".
    return $ConfigKey.Replace(':', '__')
}

function Test-ValidReference([string] $ValueName) {
    $match = [regex]::Match($ValueName, $ReferencePattern)

    return $match.Success -and $Catalog.ContainsKey($match.Groups['service'].Value)
}

function Get-ReferenceErrors([string] $ProjectKey, [hashtable] $Mapping) {
    return $Mapping.GetEnumerator() |
        Where-Object { $_.Value.StartsWith('@') -and -not (Test-ValidReference $_.Value) } |
        ForEach-Object { "${ProjectKey}: '$($_.Key)' has an invalid reference '$($_.Value)'" }
}

function Test-ResolvesToNothing([string] $ValueName, [hashtable] $Named, [string] $ProjectKey) {
    $resolved = Resolve-MappedValue $ValueName $Named $ProjectKey

    return [string]::IsNullOrWhiteSpace($resolved) -or $resolved -eq $Placeholder
}

function Get-MissingValueErrors([string] $ProjectKey, [hashtable] $Mapping, [hashtable] $Named) {
    return $Mapping.GetEnumerator() |
        Where-Object { Test-ResolvesToNothing $_.Value $Named $ProjectKey } |
        ForEach-Object { "${ProjectKey}: '$($_.Key)' -> '$($_.Value)' resolves to nothing" }
}

function Get-ProjectErrors([hashtable] $Roots, [string] $ProjectKey, [hashtable] $Named, [bool] $RequireUserSecretsId) {
    $mapping = $Store.projects[$ProjectKey]
    $projectPath = Resolve-ProjectPath $Roots $ProjectKey

    if (-not (Test-Path -LiteralPath $projectPath)) {
        return @("${ProjectKey}: project file not found at $projectPath")
    }

    if ($RequireUserSecretsId -and -not (Get-UserSecretsId $projectPath)) {
        return @("${ProjectKey}: no UserSecretsId (add it to the project or to $PropsPath)")
    }

    $referenceErrors = @(Get-ReferenceErrors $ProjectKey $mapping)

    if ($referenceErrors.Count -gt 0) {
        return $referenceErrors
    }

    return @(Get-MissingValueErrors $ProjectKey $mapping $Named)
}

# A call to another app: local or remote in this stack (the project's own app is always local, so not listed).
function Get-RouteTarget([string] $ValueName, [string] $ProjectKey) {
    $match = [regex]::Match($ValueName, $ReferencePattern)
    $serviceName = $match.Groups['service'].Value

    if (-not $match.Success -or $AppOfProject[$ProjectKey] -eq $serviceName) {
        return $null
    }

    return $serviceName + $(if ($LocalServices -contains $serviceName) { '=local' } else { '=remote' })
}

function Format-Routes([hashtable] $Mapping, [string] $ProjectKey) {
    $routes = @($Mapping.Values | ForEach-Object { Get-RouteTarget $_ $ProjectKey } | Where-Object { $_ } | Select-Object -Unique | Sort-Object)

    return $(if ($routes.Count -gt 0) { " [calls: $($routes -join ', ')]" } else { "" })
}
