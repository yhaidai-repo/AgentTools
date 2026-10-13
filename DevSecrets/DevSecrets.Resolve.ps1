# Resolves the configuration of a project from map.json, services.json and the named values (dot-sourced).
# The caller sets $Store (map.json), $Catalog (services.json) and $LocalServices (names run locally) first.

$Placeholder = "<fill-me>"
$ReferencePattern = '^@(?<service>[a-z0-9-]+)\.(?<part>url|key|user)(\|(?<remote>.+))?$'
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

function Get-LocalPart([hashtable] $Service, [string] $Part) {
    switch ($Part) {
        'url' { return $Service.localUrl }
        'key' { return $Service.localKey }
        'user' { return $Service.localUser }
    }
}

function Resolve-Reference([string] $Reference, [hashtable] $Named) {
    $match = [regex]::Match($Reference, $ReferencePattern)
    $serviceName = $match.Groups['service'].Value
    $part = $match.Groups['part'].Value
    $remote = $match.Groups['remote'].Value

    if ($LocalServices -contains $serviceName -or -not $remote) {
        return Get-LocalPart $Catalog[$serviceName] $part
    }

    return $Named[$remote]
}

function Resolve-MappedValue([string] $ValueName, [hashtable] $Named) {
    if ($ValueName.StartsWith('@')) {
        return Resolve-Reference $ValueName $Named
    }

    return $Named[$ValueName]
}

function Resolve-ProjectConfig([string] $ProjectKey, [hashtable] $Named) {
    $config = [ordered]@{}

    $Store.projects[$ProjectKey].GetEnumerator() | Sort-Object Key | ForEach-Object { $config[$_.Key] = Resolve-MappedValue $_.Value $Named }

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

function Test-ResolvesToNothing([string] $ValueName, [hashtable] $Named) {
    $resolved = Resolve-MappedValue $ValueName $Named

    return [string]::IsNullOrWhiteSpace($resolved) -or $resolved -eq $Placeholder
}

function Get-MissingValueErrors([string] $ProjectKey, [hashtable] $Mapping, [hashtable] $Named) {
    return $Mapping.GetEnumerator() |
        Where-Object { Test-ResolvesToNothing $_.Value $Named } |
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
