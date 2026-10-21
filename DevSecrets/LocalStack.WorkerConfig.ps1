# Per-stack worker configuration of a background host (dot-sourced): which Coravel workers run and how fast.
#
# The host adds workerConfigs.json + workerConfigs.<Environment>.json after the default configuration sources, so
# they beat environment variables and user secrets; the only way to change a worker per stack is that file. It is
# written into the build output after the build (the project's copy rule is Always, so the next build restores the
# source) and removed when the stack stops (Remove-EntryConfig in LocalStack.Process.ps1). Without a request every worker is off: a local host on a shared
# database would otherwise send the emails, reports and FTP downloads dev's host is meant to send.

$WorkerConfigsFile = "workerConfigs.json"
$WorkerConfigsSection = "WorkerConfigs"
$EnvironmentVariables = @("DOTNET_ENVIRONMENT", "ASPNETCORE_ENVIRONMENT")

function Get-BuildOutputDir([string] $ProjectPath) {
    $outDir = (dotnet msbuild $ProjectPath -getProperty:OutDir -nologo 2>&1 | Select-Object -Last 1).Trim()

    if ($LASTEXITCODE -ne 0 -or -not $outDir) {
        throw "Could not read the build output folder of $ProjectPath"
    }

    return Join-Path (Split-Path $ProjectPath) $outDir
}

function Get-LaunchProfileEnvironment([string] $ProjectPath, [string] $LaunchProfile) {
    $settings = Get-Content -Raw (Join-Path (Split-Path $ProjectPath) "Properties/launchSettings.json") | ConvertFrom-Json -AsHashtable
    $variables = $settings.profiles[$LaunchProfile].environmentVariables ?? @{}
    $environment = $EnvironmentVariables | ForEach-Object { $variables[$_] } | Where-Object { $_ } | Select-Object -First 1

    if (-not $environment) {
        throw "Launch profile $LaunchProfile of $ProjectPath names no environment; the worker configuration needs one."
    }

    return $environment
}

function Read-WorkerDefaults([string] $OutputDir) {
    $source = Get-Content -Raw (Join-Path $OutputDir $WorkerConfigsFile) | ConvertFrom-Json -AsHashtable

    return $source[$WorkerConfigsSection]
}

function Assert-KnownWorkers([hashtable] $Defaults, [hashtable] $Workers) {
    $unknown = @($Workers.Keys | Where-Object { -not $Defaults.ContainsKey($_) })

    if ($unknown.Count -gt 0) {
        throw "Unknown worker(s): $($unknown -join ', '). $WorkerConfigsFile names: $(($Defaults.Keys | Sort-Object) -join ', ')"
    }
}

# Every worker off, the requested ones on with their defaults under the requested fields (RunAtStart, Cron, …).
function Merge-WorkerConfigs([hashtable] $Defaults, [hashtable] $Workers) {
    $merged = [ordered]@{}

    foreach ($name in ($Defaults.Keys | Sort-Object)) {
        $entry = [ordered]@{}
        $Defaults[$name].GetEnumerator() | ForEach-Object { $entry[$_.Key] = $_.Value }
        $entry["Enabled"] = $Workers.ContainsKey($name)
        ($Workers[$name] ?? @{}).GetEnumerator() | ForEach-Object { $entry[$_.Key] = $_.Value }
        $merged[$name] = $entry
    }

    return $merged
}

# Writes the environment file into the build output and returns its path with the workers in effect.
function Write-WorkerConfigs([string] $ProjectPath, [string] $LaunchProfile, [hashtable] $Workers) {
    $outputDir = Get-BuildOutputDir $ProjectPath
    $environment = Get-LaunchProfileEnvironment $ProjectPath $LaunchProfile
    $defaults = Read-WorkerDefaults $outputDir

    Assert-KnownWorkers $defaults $Workers

    $path = Join-Path $outputDir "workerConfigs.$environment.json"
    $document = [ordered]@{ $WorkerConfigsSection = (Merge-WorkerConfigs $defaults $Workers) }

    Set-Content -LiteralPath $path -Value ($document | ConvertTo-Json -Depth 4) -Encoding utf8
    Write-Host "Workers in $environment`: $(if ($Workers.Count -gt 0) { ($Workers.Keys | Sort-Object) -join ', ' } else { 'none' }) ($path)"

    return @{ file = $path; workers = @($Workers.Keys | Sort-Object); environment = Get-ContentRootEnvironment $outputDir }
}

# The host reads its workerConfigs files from the content root, which is the working directory of `dotnet run`: the
# project's source folder. Pointing it at the build output makes the host read the file written there.
function Get-ContentRootEnvironment([string] $OutputDir) {
    return @{ DOTNET_CONTENTROOT = $OutputDir }
}
