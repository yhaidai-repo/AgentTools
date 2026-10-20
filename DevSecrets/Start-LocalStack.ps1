<#
.SYNOPSIS
    Starts a chain of local services pointed at each other, waits until each one is ready, and leaves them running.

.DESCRIPTION
    1. Picks the checkouts: the main ones, or a worktree per repo for -Branch (created when missing).
    2. Applies the local patches (Use-LocalPatches.ps1) and prepares Signals (Deno cache).
    3. Resolves each service's configuration like Use-DevSecrets.ps1, but passes it as environment variables,
       so user secrets and other worktrees stay untouched. Calls between the listed services go to localhost,
       everything else to Azure dev.
    4. Starts the local RabbitMQ container when a service consumes the bus (services.json "consumesBus").
    5. Builds each run project, starts it with `dotnet run --no-build --launch-profile`, and waits until it is
       ready: its local URL ("<app>-url" in values.local.json) answers, its log shows run.readyLog, or run.readyProcess runs.

    One stack per machine: ports are fixed in services.json. Stop it with Stop-LocalStack.ps1, inspect it with
    Get-LocalStack.ps1. Logs, stack.json and generated files go to D:/Projects/dev-secrets/stack (LOCAL_STACK_DIR).

.EXAMPLE
    ./Start-LocalStack.ps1 -Services pvs-web,pvs-background,pvs-transaction-consumer,signals

.EXAMPLE
    ./Start-LocalStack.ps1 -Services pvs-web,signals -Branch feature/26885-Transactions-management-feature
    Runs the branch's worktrees of PVS and PVS.Internal (existing ones are reused).

.EXAMPLE
    ./Start-LocalStack.ps1 -Services pvs-web -Repo pvs=D:/Projects/PVS-wt/feature/x
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string[]] $Services,

    [string] $Branch,

    [string[]] $Repo = @(),

    [string] $Values = "dev",

    [int] $TimeoutSeconds = 300,

    [switch] $SkipBuild,

    [switch] $NoPatches
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot/DevSecrets.Common.ps1"
. "$PSScriptRoot/DevSecrets.Resolve.ps1"
. "$PSScriptRoot/LocalStack.Worktree.ps1"
. "$PSScriptRoot/LocalStack.RabbitMq.ps1"
. "$PSScriptRoot/LocalStack.Redis.ps1"
. "$PSScriptRoot/LocalStack.Process.ps1"

function Add-BusWhenConsumed([string[]] $Names) {
    $consumes = @($Names | Where-Object { $Catalog[$_].consumesBus })

    if ($consumes.Count -eq 0 -or $Names -contains "rabbitmq") {
        return $Names
    }

    Write-Host "Adding rabbitmq: $($consumes -join ', ') consume the bus"

    return @("rabbitmq") + $Names
}

function Add-CacheWhenUsed([string[]] $Names) {
    $uses = @($Names | Where-Object { $Catalog[$_].usesCache })

    if ($uses.Count -eq 0 -or $Names -contains "redis") {
        return $Names
    }

    Write-Host "Adding redis: $($uses -join ', ') cache there"

    return @("redis") + $Names
}

function Assert-Runnable([string[]] $Names) {
    $notRunnable = @($Names | Where-Object { -not $Catalog[$_].run })

    if ($notRunnable.Count -gt 0) {
        throw "No 'run' entry in services.json for: $($notRunnable -join ', ')"
    }
}

function Assert-NoRunningStack() {
    $state = Read-StackState

    if (-not $state) {
        return
    }

    $alive = @($state.services | Where-Object { Test-EntryAlive $_ } | ForEach-Object { $_.name })

    if ($alive.Count -gt 0) {
        throw "A local stack is running ($($alive -join ', ')). Run Stop-LocalStack.ps1 first."
    }

    Remove-Item -LiteralPath $StatePath -Force
}

function Test-PortInUse([string] $Url) {
    $port = ([uri] $Url).Port

    return $null -ne (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Get-ServicePorts([string] $Name) {
    $service = $Catalog[$Name]

    return @((Get-LocalUrl $Name), $service.run.managementUrl) | Where-Object { $_ -and $_ -match '^https?://' }
}

function Assert-PortsFree([string[]] $Names) {
    $busy = @($Names | Where-Object { @(Get-ServicePorts $_ | Where-Object { Test-PortInUse $_ }).Count -gt 0 })

    if ($busy.Count -gt 0) {
        throw "Port already in use for: $(($busy | ForEach-Object { "$_ ($(Get-ServicePorts $_))" }) -join ', '). Stop what runs there first."
    }
}

function Set-RequiredEnv([string] $Variable, [string] $Expected) {
    # A user variable set with setx is missing in shells opened before it; take it from the user scope then.
    $value = [Environment]::GetEnvironmentVariable($Variable) ?? [Environment]::GetEnvironmentVariable($Variable, "User")

    if ($value -ne $Expected) {
        return $false
    }

    [Environment]::SetEnvironmentVariable($Variable, $value)

    return $true
}

function Get-RequiredEnvErrors([string] $Name) {
    $required = $Catalog[$Name].run.requiresEnv

    if (-not $required) {
        return @()
    }

    return @($required.GetEnumerator() | Where-Object { -not (Set-RequiredEnv $_.Key $_.Value) } |
        ForEach-Object { "${Name}: environment variable $($_.Key) must be '$($_.Value)' (setx $($_.Key) $($_.Value))" })
}

function Assert-RequiredEnv([string[]] $Names) {
    $errors = @($Names | ForEach-Object { Get-RequiredEnvErrors $_ })

    if ($errors.Count -gt 0) {
        throw ($errors -join [Environment]::NewLine)
    }
}

function Get-RepoNames([string[]] $Names) {
    return @($Names | ForEach-Object { $Catalog[$_].projects } | ForEach-Object { ($_ -split '/')[0] } | Select-Object -Unique)
}

function Get-AppServices([string[]] $Names) {
    return @($Names | Where-Object { $Catalog[$_].run.project })
}

function Assert-ProjectsResolve([string[]] $Names, [hashtable] $Roots, [hashtable] $Named) {
    $projects = @($Names | ForEach-Object { $Catalog[$_].projects } | Select-Object -Unique)
    $errors = @($projects | ForEach-Object { Get-ProjectErrors $Roots $_ $Named $false })

    if ($errors.Count -gt 0) {
        $errors | ForEach-Object { Write-Error $_ -ErrorAction Continue }

        throw "Nothing was started: fix the $($errors.Count) problem(s) above."
    }
}

function Add-ProjectEnvironment([hashtable] $Environment, [string] $ProjectKey, [hashtable] $Named) {
    foreach ($entry in (Resolve-ProjectConfig $ProjectKey $Named).GetEnumerator()) {
        $variable = ConvertTo-EnvironmentName $entry.Key

        if ($Environment.ContainsKey($variable) -and $Environment[$variable] -ne $entry.Value) {
            throw "${ProjectKey}: '$($entry.Key)' differs from another project of the same service; one environment cannot hold both."
        }

        $Environment[$variable] = $entry.Value
    }
}

function Get-ServiceEnvironment([string] $Name, [hashtable] $Named) {
    # Every project of the service (e.g. an AppHost and its children) shares one environment.
    $environment = @{}

    $Catalog[$Name].projects | ForEach-Object { Add-ProjectEnvironment $environment $_ $Named }

    return $environment
}

function Initialize-Signals([string[]] $Names, [hashtable] $Roots) {
    $Names | Where-Object { $Catalog[$_].run.denoScripts } | ForEach-Object { Initialize-DenoCache (Resolve-ProjectPath $Roots $Catalog[$_].run.denoScripts) }
}

function Initialize-NpmProjects([string[]] $Names, [hashtable] $Roots) {
    $Names | Where-Object { $Catalog[$_].run.npmPackages } | ForEach-Object { $name = $_; $Catalog[$name].run.npmPackages | ForEach-Object { Initialize-NpmPackages (Resolve-ProjectPath $Roots $_) } }
}

function Start-AppServices([string[]] $Names, [hashtable] $Roots, [hashtable] $Named, [hashtable] $State) {
    foreach ($name in $Names) {
        $projectPath = Resolve-ProjectPath $Roots $Catalog[$name].run.project
        $State.services += Start-ServiceProcess $name $Catalog[$name] $projectPath (Get-ServiceEnvironment $name $Named)
        Save-StackState $State
    }
}

function Wait-StackReady([hashtable] $State) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $failed = @($State.services | Where-Object { -not (Wait-EntryReady $_ $deadline) })

    if ($failed.Count -eq 0) {
        return
    }

    $failed | ForEach-Object { Write-FailureLog $_ }
    Stop-Stack $State

    throw "Not ready: $(($failed | ForEach-Object { $_.name }) -join ', '). The stack was stopped."
}

$Catalog = Read-Services
$Store = Read-Store
Initialize-LocalValues
$names = Get-ServiceNames $Services

Assert-KnownServices $Catalog $names

$names = Add-BusWhenConsumed $names
$names = Add-CacheWhenUsed $names
$LocalServices = $names
$appServices = Get-AppServices $names

Assert-Runnable $names
Assert-NoRunningStack
Assert-PortsFree $names
Assert-RequiredEnv $names

$repoNames = Get-RepoNames $names
$roots = Get-StackRoots $Store.repos $repoNames $Branch $Repo
$named = Read-NamedValues $Values

Assert-ProjectsResolve $names $roots $named

if (-not $NoPatches) {
    Invoke-LocalPatches @($repoNames | ForEach-Object { $roots[$_] })
}

Initialize-Signals $names $roots
Initialize-NpmProjects $names $roots

New-Item -ItemType Directory -Force -Path $StackDir | Out-Null
Get-ChildItem -LiteralPath $StackDir -Filter "*.log" | Remove-Item -Force

if (-not $SkipBuild) {
    $appServices | ForEach-Object { Build-Project (Resolve-ProjectPath $roots $Catalog[$_].run.project) }
}

$state = @{ branch = $Branch; environment = $Values; roots = $roots; services = @() }

if ($names -contains "rabbitmq") {
    $state.services += Start-LocalRabbitMq $named $Catalog["rabbitmq"]
    Save-StackState $state
}

if ($names -contains "redis") {
    $state.services += Start-LocalRedis $Catalog["redis"]
    Save-StackState $state
}

Start-AppServices $appServices $roots $named $state
Wait-StackReady $state

Write-Host "Local stack ready. Logs: $StackDir. Stop with Stop-LocalStack.ps1."
$state.services | Where-Object { $_.url } | ForEach-Object { Write-Host "  $($_.name): $($_.url)" }
