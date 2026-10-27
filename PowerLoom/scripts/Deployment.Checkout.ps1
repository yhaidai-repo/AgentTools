# Compare the intended compose bind sources with every existing application service before any image build.
function ConvertTo-DeploymentPath([string]$Path) {
    $value = $Path.Replace('\', '/').TrimEnd('/')
    # Docker Desktop may report a Windows bind through its Linux host-mount prefix.
    if ($value -match '^/(?:run/desktop/mnt/host|host_mnt)/([a-zA-Z])/(.*)$') {
        $value = "$($Matches[1]):/$($Matches[2])"
    }
    if ($value -match '^[a-zA-Z]:/') { return $value.ToLowerInvariant() }
    return $value
}

function Read-DeploymentJson([string[]]$Arguments) {
    $json = docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect deployment configuration ($($Arguments[0]))." }
    return ($json -join "`n") | ConvertFrom-Json -AsHashtable
}

function Get-DeploymentContainers([string]$Service) {
    $ids = docker compose ps --all --quiet $Service
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect deployment service $Service." }
    foreach ($id in @($ids | Where-Object { $_ })) {
        Read-DeploymentJson @('inspect', $id)
    }
}

function Assert-DeploymentCheckout([string]$Root) {
    $config = Read-DeploymentJson @('compose', 'config', '--format', 'json')
    $expectedRoot = ConvertTo-DeploymentPath ([IO.Path]::GetFullPath($Root))
    foreach ($name in @('powerloom', 'agent-runner', 'web', 'mcp')) {
        foreach ($container in @(Get-DeploymentContainers $name)) {
            $deployedRoot = $container.Config.Labels['com.docker.compose.project.working_dir']
            if (-not $deployedRoot -or (ConvertTo-DeploymentPath $deployedRoot) -cne $expectedRoot) {
                throw "Deployment checkout differs for $name. Use the currently deployed checkout ($deployedRoot), or explicitly migrate all service mounts and persistent homes before deploying."
            }
            $expectedBinds = @($config.services[$name].volumes | Where-Object type -eq 'bind')
            $actualBinds = @($container.Mounts | Where-Object Type -eq 'bind')
            if ($actualBinds.Count -ne $expectedBinds.Count) {
                throw "Deployment bind differs for ${name}: existing and intended bind sets differ. Coordinate all shared source and persistent mounts before deploying."
            }
            foreach ($volume in $expectedBinds) {
                $mounted = @($container.Mounts | Where-Object Destination -eq $volume.target)
                if ($mounted.Count -ne 1 -or $mounted[0].Type -ne 'bind' -or
                    (ConvertTo-DeploymentPath $mounted[0].Source) -cne (ConvertTo-DeploymentPath $volume.source)) {
                    throw "Deployment bind differs for $name at $($volume.target). Restore the deployed bind configuration or explicitly coordinate a full mount migration; nothing was built or recreated."
                }
            }
        }
    }
}
