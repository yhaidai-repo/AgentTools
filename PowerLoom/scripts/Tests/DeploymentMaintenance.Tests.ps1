BeforeAll {
    . (Join-Path $PSScriptRoot '..' 'Deployment.Maintenance.ps1')
    # Load only the actual Docker/query wrappers for mocking; do not execute deployment.
    $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '..' 'deploy-web.ps1'), [ref]$null, [ref]$null)
    foreach ($definition in $ast.FindAll({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
        . ([scriptblock]::Create($definition.Extent.Text))
    }
}
Describe 'The disruptive deployment interval' {
    BeforeEach {
        $script:WithApi = $true; $script:WithRunner = $true; $script:Force = $false
        $script:events = [Collections.Generic.List[string]]::new()
        $script:held = $false; $script:runningTask = $null; $script:dbRuns = @()
        Mock Invoke-Compose { param($arguments) $script:events.Add(($arguments -join ' ')) }
        Mock Get-RunningRuns { $script:events.Add('query'); return $script:dbRuns }
        Mock Show-RunningRuns {}
        Mock Invoke-RunnerMaintenance {
            param($Method, $Owner)
            $script:events.Add($Method)
            $script:held = $Method -eq 'PUT'
            return @{ status = 200; body = @{ owner = $Owner; running = $script:runningTask } }
        }
    }
    It 'refuses work appearing during either build without recreating anything' -ForEach @(@{ Build = 'powerloom' }, @{ Build = 'agent-runner' }) {
        Mock Invoke-Compose { param($arguments) $script:events.Add(($arguments -join ' ')); if ($arguments[0] -eq 'build' -and $arguments[1] -eq $Build) { $script:dbRuns = @('99 active') } }
        { Invoke-Deployment } | Should -Throw '*work remains after builds*'
        @($events | Where-Object { $_ -like 'up *' }).Count | Should -Be 0
        $held | Should -BeFalse
        $events.IndexOf('query') | Should -BeGreaterThan $events.IndexOf('build agent-runner')
    }
    It 'refuses an accepted runner job even before its database row exists' {
        $script:runningTask = 'AT-pending-row'
        { Invoke-Deployment } | Should -Throw '*work remains after builds*'
        @($events | Where-Object { $_ -like 'up *' }).Count | Should -Be 0
        $held | Should -BeFalse
    }
    It 'holds the barrier through every restart and checks again immediately before runner recreation' -ForEach @(@{ Paused = $true }, @{ Paused = $false }) {
        $originalPause = $Paused
        Mock Invoke-Compose { param($arguments) if ($arguments[0] -eq 'up') { $script:held | Should -BeTrue }; $script:events.Add(($arguments -join ' ')) }
        Invoke-Deployment
        $events[0] | Should -Be 'build powerloom'
        $events[1] | Should -Be 'build agent-runner'
        $events[-1] | Should -Be 'DELETE'
        @($events | Where-Object { $_ -eq 'query' }).Count | Should -Be 2
        $Paused | Should -Be $originalPause
        $held | Should -BeFalse
    }
    It 'releases the barrier after a restart error and preserves that original error' {
        Mock Invoke-Compose { param($arguments) if ($arguments[0] -eq 'up') { throw 'synthetic restart failure' } }
        { Invoke-Deployment } | Should -Throw '*synthetic restart failure*'
        $held | Should -BeFalse
        $events[-1] | Should -Be 'DELETE'
    }
    It 'does not acquire a lease if a build fails' {
        Mock Invoke-Compose { throw 'build failed' }
        { Invoke-Deployment } | Should -Throw '*build failed*'
        Should -Invoke Invoke-RunnerMaintenance -Times 0
    }
    It 'requires explicit Force before interrupting work' {
        $script:Force = $true; $script:runningTask = 'AT-active'; $script:dbRuns = @('99 active')
        Invoke-Deployment
        @($events | Where-Object { $_ -like 'up *' }).Count | Should -Be 3
        $held | Should -BeFalse
    }
    It 'fails closed on an older runner without a barrier' {
        Mock Invoke-RunnerMaintenance { @{ status = 404; body = @{} } }
        { Invoke-Deployment } | Should -Throw '*maintenance was not acquired*'
        @($events | Where-Object { $_ -like 'up *' }).Count | Should -Be 0
    }
    It 'allows the documented old-runner bootstrap only with explicit Force' {
        $script:Force = $true
        Mock Invoke-RunnerMaintenance { @{ status = 404; body = @{} } }
        Invoke-Deployment -WarningAction SilentlyContinue
        @($events | Where-Object { $_ -like 'up *' }).Count | Should -Be 3
    }
    It 'tries owner-scoped release if acquisition succeeded but its response was lost' {
        Mock Invoke-RunnerMaintenance { param($Method, $Owner) if ($Method -eq 'PUT') { $script:held = $true; throw 'response lost' }; $script:held = $false; @{status = 200; body = @{}} }
        { Invoke-Deployment } | Should -Throw '*response lost*'
        $held | Should -BeFalse
    }
    It 'keeps an original restart failure when release also fails' {
        Mock Invoke-Compose { param($arguments) if ($arguments[0] -eq 'up') { throw 'original restart error' } }
        Mock Invoke-RunnerMaintenance { param($Method, $Owner) if ($Method -eq 'DELETE') { throw 'release failed' }; @{status = 200; body = @{owner = $Owner}} }
        { Invoke-Deployment -WarningAction SilentlyContinue } | Should -Throw '*original restart error*'
    }
}
