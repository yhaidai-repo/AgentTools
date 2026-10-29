# Switch monitoring before any app restart, so rollback keeps the running app's existing exporter destination.
# History volumes are never deleted.
function Get-TelemetryDeploymentPlan {
    $config = Read-DeploymentJson @('compose', '--profile', 'observability', 'config', '--format', 'json')
    if ([string]::IsNullOrWhiteSpace($config.services.web.environment.TELEMETRY_INTERNAL_URL)) { return $null }

    $port = @($config.services.telemetry.ports | Where-Object target -eq 18888)[0]
    if (-not $port -or $port.host_ip -ne '127.0.0.1') { throw 'The telemetry UI must have a loopback-only published port.' }

    $legacy = docker ps --quiet --filter "label=com.docker.compose.project=$($config.name)" --filter 'label=com.docker.compose.service=otel-lgtm' --filter status=running
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the previous monitoring container.' }

    return @{ Url = "http://127.0.0.1:$($port.published)"; Legacy = @($legacy | Where-Object { $_ }) }
}

function Invoke-TelemetryDocker([string[]]$Arguments) {
    docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Monitoring deployment failed: docker $($Arguments -join ' ')." }
}

function Wait-TelemetryDashboard([string]$Url) {
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw 'Aspire Dashboard did not become ready.'
}

function Set-TelemetryDashboard {
    $plan = Get-TelemetryDeploymentPlan
    if ($null -eq $plan) { return }

    $stopped = [Collections.Generic.List[string]]::new()
    try {
        foreach ($id in $plan.Legacy) {
            Invoke-TelemetryDocker @('stop', $id)
            $stopped.Add($id)
        }
        Invoke-TelemetryDocker @('compose', 'up', '-d', '--no-deps', 'telemetry')
        Wait-TelemetryDashboard $plan.Url
        Write-Host "Aspire Dashboard is ready at $($plan.Url). Existing monitoring history volumes were preserved."
    } catch {
        $failure = $_
        if ($stopped.Count -gt 0) {
            try { Invoke-TelemetryDocker @('compose', 'stop', 'telemetry') }
            catch { Write-Warning 'Could not stop the replacement monitoring container for rollback.' }
            foreach ($id in $stopped) {
                try { Invoke-TelemetryDocker @('start', $id) }
                catch { Write-Warning "Could not restart previous monitoring container $id." }
            }
        }
        throw $failure
    }
}
