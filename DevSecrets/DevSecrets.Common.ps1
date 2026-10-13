# Shared by the DevSecrets scripts (dot-sourced). No secrets, no state.

$StoreDir = $PSScriptRoot
# Secret values stay outside any git repo; override with DEV_SECRETS_VALUES_DIR.
$ValuesDir = if ($env:DEV_SECRETS_VALUES_DIR) { $env:DEV_SECRETS_VALUES_DIR } else { "D:/Projects/dev-secrets" }
$PropsPath = "D:/Projects/Directory.Build.props"
# Local stack state, logs and generated files (they hold secrets): next to the values, outside git; override with LOCAL_STACK_DIR.
# Not under %LOCALAPPDATA%: Docker Desktop showed a stale, empty view of a folder created there and mounted right away.
$StackDir = if ($env:LOCAL_STACK_DIR) { $env:LOCAL_STACK_DIR } else { Join-Path $ValuesDir "stack" }
$StatePath = Join-Path $StackDir "stack.json"

function Read-JsonFile([string] $Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path"
    }

    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json -AsHashtable
}

function Read-Store() {
    return Read-JsonFile (Join-Path $StoreDir "map.json")
}

function Read-Services() {
    return Read-JsonFile (Join-Path $StoreDir "services.json")
}

function Get-ServiceNames([string[]] $Names) {
    return @($Names | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
}

function Assert-KnownServices([hashtable] $Catalog, [string[]] $Names) {
    # foreach, not a pipeline: an empty list arrives as $null, which a pipeline would pass through as one item.
    $unknown = @(foreach ($name in $Names) { if (-not $Catalog.ContainsKey($name)) { $name } })

    if ($unknown.Count -gt 0) {
        throw "Unknown service(s): $($unknown -join ', '). Known: $(($Catalog.Keys | Sort-Object) -join ', ')"
    }
}

function Resolve-ProjectPath([hashtable] $Roots, [string] $ProjectKey) {
    $repoName, $relative = $ProjectKey -split '/', 2

    return Join-Path $Roots[$repoName] $relative
}

function Read-StackState() {
    if (-not (Test-Path -LiteralPath $StatePath)) {
        return $null
    }

    return Read-JsonFile $StatePath
}

function Save-StackState([hashtable] $State) {
    New-Item -ItemType Directory -Force -Path $StackDir | Out-Null
    $State | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $StatePath -Encoding utf8NoBOM
}
