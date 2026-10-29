BeforeAll {
    . (Join-Path $PSScriptRoot '..' 'Deployment.Observability.ps1')
    . (Join-Path $PSScriptRoot '..' 'Deployment.Maintenance.ps1')
    $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '..' 'deploy-web.ps1'), [ref]$null, [ref]$null)
    $entry = $ast.Find({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Invoke-PowerLoomDeployment' }, $true)
    . ([scriptblock]::Create($entry.Extent.Text))
}

Describe 'Replacing local monitoring' {
    BeforeEach {
        $script:events = [Collections.Generic.List[string]]::new()
        Mock Get-TelemetryDeploymentPlan { @{ Url = 'http://127.0.0.1:3200'; Legacy = @('old-monitoring') } }
        Mock Invoke-TelemetryDocker { param($Arguments) $script:events.Add(($Arguments -join ' ')) }
        Mock Wait-TelemetryDashboard { $script:events.Add('ready') }
        $script:exporter = 'http://otel-lgtm:4317'
        Mock Invoke-Deployment { $script:exporter = 'http://telemetry:4317'; $script:events.Add('restart application') }
        Mock Write-Host {}
    }

    It 'leaves monitoring disabled without touching containers' {
        Mock Get-TelemetryDeploymentPlan { $null }
        Set-TelemetryDashboard
        $events.Count | Should -Be 0
    }

    It 'frees the old local port and verifies the new viewer without deleting history' {
        Set-TelemetryDashboard
        $events | Should -Be @('stop old-monitoring', 'compose up -d --no-deps telemetry', 'ready')
        @($events | Where-Object { $_ -match '(^| )(rm|down|volume)( |$)' }).Count | Should -Be 0
    }

    It 'restores previous monitoring if the replacement never becomes ready' {
        Mock Wait-TelemetryDashboard { throw 'synthetic readiness failure' }
        { Set-TelemetryDashboard } | Should -Throw '*synthetic readiness failure*'
        $events[-2] | Should -Be 'compose stop telemetry'
        $events[-1] | Should -Be 'start old-monitoring'
    }

    It 'retains the running exporter destination and aborts app rollout when cutover fails' {
        Mock Wait-TelemetryDashboard { throw 'synthetic readiness failure' }
        { Invoke-PowerLoomDeployment } | Should -Throw '*synthetic readiness failure*'
        $exporter | Should -Be 'http://otel-lgtm:4317'
        $events[-1] | Should -Be 'start old-monitoring'
        Should -Invoke Invoke-Deployment -Times 0
    }

    It 'restarts the app with its new exporter only after the viewer is ready' {
        Invoke-PowerLoomDeployment
        $events.IndexOf('restart application') | Should -BeGreaterThan $events.IndexOf('ready')
        $exporter | Should -Be 'http://telemetry:4317'
    }

    It 'does not stop an existing Aspire deployment when there is no legacy fallback' {
        Mock Get-TelemetryDeploymentPlan { @{ Url = 'http://127.0.0.1:3200'; Legacy = @() } }
        Mock Wait-TelemetryDashboard { throw 'synthetic read failure' }
        { Set-TelemetryDashboard } | Should -Throw '*synthetic read failure*'
        $events | Should -Be @('compose up -d --no-deps telemetry')
    }
}
