BeforeAll {
    # Load real function bodies without invoking the startup script or native helpers.
    $dev = Split-Path -Parent $PSScriptRoot
    foreach ($file in @('DevSecrets.Common.ps1', 'DevSecrets.Resolve.ps1', 'LocalStack.WorkerConfig.ps1', 'LocalStack.Process.ps1', 'LocalStack.RabbitMq.ps1', 'LocalStack.Redis.ps1', 'Start-LocalStack.ps1')) {
        $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $dev $file), [ref]$null, [ref]$null)
        foreach ($function in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
            . ([scriptblock]::Create($function.Extent.Text))
        }
    }
    $WorkerConfigsFile = 'workerConfigs.json'
    $WorkerConfigsSection = 'WorkerConfigs'
    $TimeoutSeconds = 1
    $script:publish = ${function:Publish-WorkerConfigs}
    $script:save = ${function:Save-StackState}
    $script:startProcess = ${function:Start-ServiceProcess}
    $script:stopEntry = ${function:Stop-Entry}
}

Describe 'A local stack start owns its rollback' {
    BeforeEach {
        $script:StackDir = Join-Path $TestDrive ([guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory $StackDir | Out-Null
        $script:StatePath = Join-Path $StackDir 'stack.json'
        $script:Catalog = @{}
        foreach ($name in @('one', 'two')) {
            $output = Join-Path $StackDir $name
            New-Item -ItemType Directory $output | Out-Null
            '{"WorkerConfigs":{"Known":{"Enabled":false,"RunAtStart":false}}}' | Set-Content (Join-Path $output 'workerConfigs.json')
            $Catalog[$name] = @{ configurable = @('workers'); run = @{ project = $output; launchProfile = 'synthetic' } }
        }
        $Catalog.rabbitmq = @{ run = @{ managementUrl = 'http://synthetic.invalid' } }
        $Catalog.redis = @{ run = @{ url = 'http://synthetic.invalid' } }
        $script:state = @{ services = @() }
        $script:running = @{}
        $script:stopped = @()
        Mock Resolve-ProjectPath { param($Roots, $ProjectKey) $ProjectKey }
        Mock Get-BuildOutputDir { param($ProjectPath) $ProjectPath }
        Mock Get-LaunchProfileEnvironment { 'Synthetic' }
        Mock Get-StartEnvironment { @{} }
        Mock Start-ServiceProcess {
            param($Name, $Service, $ProjectPath, $Environment, $State)
            $entry = @{ name = $Name; kind = 'process' }
            $State.services += $entry
            $script:running[$Name] = $true
            return $entry
        }
        Mock Stop-Entry { param($Entry) $script:running.Remove($Entry.name); $script:stopped += $Entry.name }
        Mock Wait-EntryReady { $true }
        Mock Write-FailureLog {}
        Mock Test-LocalRabbitMqExists { $false }
        Mock Test-LocalRedisExists { $false }
        Mock Invoke-RabbitCompose {}
        Mock Invoke-RedisCompose {}
        Mock Set-RabbitShovel {}
    }

    It 'validates every worker before changing an earlier override' {
        $path = Join-Path $StackDir 'one/workerConfigs.Synthetic.json'
        [IO.File]::WriteAllText($path, 'original')
        { Start-StackAttempt @('one', 'two') @('one', 'two') @{} @{} @{ one = @{ workers = @{ Known = @{ RunAtStart = $true } } }; two = @{ workers = @{ Unknown = @{} } } } $state } | Should -Throw '*Unknown worker*'
        [IO.File]::ReadAllText($path) | Should -BeExactly 'original'
        Test-Path (Join-Path $StackDir 'two/workerConfigs.Synthetic.json') | Should -BeFalse
        Should -Invoke Start-ServiceProcess -Times 0
    }

    It 'restores all originals after a later publication fails' {
        foreach ($name in @('one', 'two')) { [IO.File]::WriteAllText((Join-Path $StackDir "$name/workerConfigs.Synthetic.json"), "original-$name") }
        Mock Publish-WorkerConfigs {
            param($Prepared)
            & $script:publish $Prepared
            if ($Prepared.file -like '*two*') { throw 'synthetic write failure' }
        }
        { Start-StackAttempt @('one', 'two') @('one', 'two') @{} @{} @{} $state } | Should -Throw '*synthetic write failure*'
        foreach ($name in @('one', 'two')) { [IO.File]::ReadAllText((Join-Path $StackDir "$name/workerConfigs.Synthetic.json")) | Should -BeExactly "original-$name" }
        Should -Invoke Start-ServiceProcess -Times 0
    }

    It 'publishes successfully and normal stop restores bytes even after loading saved state' {
        $path = Join-Path $StackDir 'one/workerConfigs.Synthetic.json'
        [IO.File]::WriteAllBytes($path, [byte[]]@(239,187,191,111,108,100))
        Start-StackAttempt @('one', 'two') @('one', 'two') @{} @{} @{ one = @{ workers = @{ Known = @{ RunAtStart = $true } } } } $state
        ((Get-Content -Raw $path | ConvertFrom-Json).WorkerConfigs.Known).RunAtStart | Should -BeTrue
        Stop-Stack (Read-StackState)
        [Convert]::ToBase64String([IO.File]::ReadAllBytes($path)) | Should -Be '77u/b2xk'
        Test-Path (Join-Path $StackDir 'two/workerConfigs.Synthetic.json') | Should -BeFalse
        Test-Path $StatePath | Should -BeFalse
        $running.Count | Should -Be 0
    }

    It 'stops an earlier service when the later launch fails' {
        Mock Start-ServiceProcess {
            param($Name, $Service, $ProjectPath, $Environment, $State)
            if ($Name -eq 'two') { throw 'second launch failed' }
            $entry = @{ name = $Name; kind = 'process' }; $State.services += $entry; $script:running[$Name] = $true; $entry
        }
        { Start-StackAttempt @('one', 'two') @('one', 'two') @{} @{} @{} $state } | Should -Throw '*second launch failed*'
        $running.Count | Should -Be 0
        $stopped | Should -Contain 'one'
        Test-Path $StatePath | Should -BeFalse
    }

    It 'cleans a launched service after its state save fails' {
        Mock Save-StackState {
            param($State)
            if ($State.services.Count -gt 0) { throw 'state save failed' }
            & $script:save $State
        }
        { Start-StackAttempt @('one') @('one') @{} @{} @{} $state } | Should -Throw '*state save failed*'
        $running.Count | Should -Be 0
        $stopped | Should -Contain 'one'
    }

    It 'cleans compose after post-start shovel setup fails' {
        Mock Set-RabbitShovel { throw 'shovel failed' }
        { Start-StackAttempt @('rabbitmq') @() @{} @{} @{} $state } | Should -Throw '*shovel failed*'
        $stopped | Should -Contain 'rabbitmq'
        Should -Invoke Invoke-RabbitCompose -Times 1
    }

    It 'cleans compose when up itself partially fails' {
        Mock Invoke-RedisCompose { throw 'compose up failed' }
        { Start-StackAttempt @('redis') @() @{} @{} @{} $state } | Should -Throw '*compose up failed*'
        $stopped | Should -Contain 'redis'
    }

    It 'does not take ownership of an existing compose resource' {
        Mock Test-LocalRabbitMqExists { $true }
        { Start-StackAttempt @('rabbitmq') @() @{} @{} @{} $state } | Should -Throw '*already exists*'
        Should -Invoke Invoke-RabbitCompose -Times 0
        $stopped.Count | Should -Be 0
    }

    It 'rolls readiness failure back through the same owner' {
        Mock Wait-EntryReady { $false }
        { Start-StackAttempt @('one', 'two') @('one', 'two') @{} @{} @{} $state } | Should -Throw '*Not ready*'
        $running.Count | Should -Be 0
        $stopped.Count | Should -Be 2
    }

    It 'registers the actual process helper before environment cleanup can fail' {
        Mock Get-LocalUrl { 'http://synthetic.invalid' }
        Mock Set-ProcessEnvironment {}
        Mock Set-StdHandlesInheritable { param($Inheritable) if ($Inheritable) { throw 'handle cleanup failed' } }
        Mock Start-Process { [pscustomobject]@{ Id = 123; StartTime = [datetime]::UtcNow } }
        { & $script:startProcess 'one' $Catalog.one (Join-Path $StackDir 'synthetic.csproj') @{} $state } | Should -Throw '*handle cleanup failed*'
        $state.services.Count | Should -Be 1
        $state.services[0].pid | Should -Be 123
        Should -Invoke Start-Process -Times 1 -ParameterFilter { $WindowStyle -eq 'Hidden' }
    }

    It 'uses real entry cleanup and restores configs only after stopping the process' {
        $script:alive = $true
        Mock Test-EntryAlive { $script:alive }
        Mock taskkill { $script:alive = $false }
        $config = Prepare-WorkerConfigs (Join-Path $StackDir 'one') 'synthetic' @{}
        Publish-WorkerConfigs $config
        $state.configs = @($config)
        $state.services = @(@{ name = 'one'; kind = 'process'; pid = 123; config = $config })
        Mock Stop-Entry { param($Entry) & $script:stopEntry $Entry }
        Stop-Stack $state
        $alive | Should -BeFalse
        Test-Path $config.file | Should -BeFalse
        Should -Invoke taskkill -Times 1
    }

    It 'continues cleanup and retains failed resources for retry without masking the original error' {
        Mock Wait-EntryReady { $false }
        Mock Stop-Entry {
            param($Entry)
            if ($Entry.name -eq 'one') { throw 'cannot stop one' }
            $script:running.Remove($Entry.name); $script:stopped += $Entry.name
        }
        { Start-StackAttempt @('one', 'two') @('one', 'two') @{} @{} @{} $state -WarningAction SilentlyContinue } | Should -Throw '*Not ready*'
        $stopped | Should -Contain 'two'
        $remaining = Read-StackState
        @($remaining.services).Count | Should -Be 1
        $remaining.services[0].name | Should -Be 'one'
        Test-Path (Join-Path $StackDir 'one/workerConfigs.Synthetic.json') | Should -BeTrue
        Mock Stop-Entry { param($Entry) $script:running.Remove($Entry.name) }
        Stop-Stack $remaining
        $running.Count | Should -Be 0
        Test-Path $StatePath | Should -BeFalse
        Test-Path (Join-Path $StackDir 'one/workerConfigs.Synthetic.json') | Should -BeFalse
    }
}
