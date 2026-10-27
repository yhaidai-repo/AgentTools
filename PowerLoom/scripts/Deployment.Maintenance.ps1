# Use the runner's event-loop acceptance barrier, persisted on its existing sessions volume across recreation.
function Invoke-RunnerMaintenance([string]$Method, [string]$Owner) {
    $program = @'
const [owner, method] = process.argv.slice(1);
const response = await fetch('http://127.0.0.1:3200/maintenance', {
  method, headers: {'Content-Type':'application/json'}, body: JSON.stringify({owner}), signal: AbortSignal.timeout(15000)
});
let body; try { body = await response.json(); } catch { body = {}; }
console.log(JSON.stringify({status:response.status,body}));
'@
    $result = docker compose exec -T agent-runner node --input-type=module -e $program $Owner $Method
    if ($LASTEXITCODE -ne 0) { throw 'Could not coordinate runner maintenance; no safe restart was established.' }
    return ($result -join "`n") | ConvertFrom-Json -AsHashtable
}

function Assert-DeploymentIdle([object]$RunningTask) {
    $runs = Get-RunningRuns
    Show-RunningRuns $runs
    if (-not $Force -and ($RunningTask -or $runs.Count -gt 0)) {
        throw 'API/runner NOT recreated: work remains after builds. Wait for it to finish, or explicitly pass -Force.'
    }
}

function Invoke-Deployment {
    # Builds are nondisruptive and may take minutes. Never rely on a pre-build run snapshot.
    if ($WithApi) { Invoke-Compose @('build', 'powerloom') }
    Invoke-Compose @('build', 'agent-runner')
    if (-not $WithApi -and -not $WithRunner) {
        Invoke-Compose @('up', '-d', '--no-deps', 'web', 'mcp')
        return
    }
    $owner = [guid]::NewGuid().ToString()
    $attempted = $false
    $unsupported = $false
    $failure = $null
    try {
        $attempted = $true
        $lease = Invoke-RunnerMaintenance 'PUT' $owner
        $unsupported = $lease.status -in @(404, 503)
        if ($unsupported -and $Force) {
            Write-Warning 'Runner lacks the maintenance barrier. Explicit -Force permits this bootstrap and may interrupt work.'
        }
        elseif ($lease.status -ne 200 -or $lease.body.owner -ne $owner) {
            throw 'Runner maintenance was not acquired. An old runner requires a separately quiesced bootstrap or explicit -Force; another deployment lease must be preserved.'
        }
        Assert-DeploymentIdle $lease.body.running
        if ($WithApi) {
            Invoke-Compose @('up', '-d', '--no-deps', '--wait', 'powerloom')
        }
        Invoke-Compose @('up', '-d', '--no-deps', 'web', 'mcp')
        if ($WithRunner) {
            Assert-DeploymentIdle $null
            Invoke-Compose @('up', '-d', '--no-deps', '--wait', 'agent-runner')
        }
    }
    catch { $failure = $_; throw }
    finally {
        if ($attempted -and -not $unsupported) {
            try {
                $released = Invoke-RunnerMaintenance 'DELETE' $owner
                if ($released.status -ne 200) { throw 'Lease release was refused.' }
            }
            catch {
                $message = "Maintenance may remain closed for deployment $owner. Reconcile that owner before resuming: $($_.Exception.Message)"
                if ($failure) { Write-Warning $message }
                else { throw $message }
            }
        }
    }
}
