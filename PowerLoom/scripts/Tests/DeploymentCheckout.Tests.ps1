BeforeAll {
    . (Join-Path $PSScriptRoot '..' 'Deployment.Checkout.ps1')
}
Describe 'Deployment checkout and bind identity' {
    BeforeEach {
        $script:deploymentRoot = 'D:/synthetic/AgentTools/PowerLoom'
        $script:containers = @{}
        $script:config = @{ services = @{} }
        foreach ($name in @('powerloom', 'agent-runner', 'web', 'mcp')) {
            $volumes = @(@{ type = 'bind'; source = "$deploymentRoot/skills"; target = '/app/PowerLoom/skills' })
            if ($name -eq 'agent-runner') { $volumes += @{ type = 'bind'; source = "$deploymentRoot/agent-homes/codex"; target = '/codex-home' } }
            $config.services[$name] = @{ volumes = $volumes }
            $containers[$name] = @{ Config = @{ Labels = @{ 'com.docker.compose.project.working_dir' = $deploymentRoot } }; Mounts = @($volumes | ForEach-Object { @{ Type = 'bind'; Source = $_.source; Destination = $_.target } }) }
        }
        Mock Read-DeploymentJson { $script:config }
        Mock Get-DeploymentContainers { param($Service) $script:containers[$Service] }
    }
    It 'accepts a consistent checkout and shared binds' {
        { Assert-DeploymentCheckout $deploymentRoot } | Should -Not -Throw
    }
    It 'refuses another worktree even on default web-only deployment' {
        { Assert-DeploymentCheckout 'D:/synthetic/other-worktree/PowerLoom' } | Should -Throw '*checkout differs*'
    }
    It 'checks every existing service, including a runner not being recreated' {
        $containers['agent-runner'].Config.Labels['com.docker.compose.project.working_dir'] = 'D:/other/PowerLoom'
        { Assert-DeploymentCheckout $deploymentRoot } | Should -Throw '*agent-runner*'
    }
    It 'refuses a changed skills or persistent-home bind' -ForEach @(@{ Target = '/app/PowerLoom/skills' }, @{ Target = '/codex-home' }) {
        ($containers['agent-runner'].Mounts | Where-Object Destination -eq $Target).Source = 'D:/other-location'
        { Assert-DeploymentCheckout $deploymentRoot } | Should -Throw '*bind differs*'
    }
    It 'recognizes the Docker Desktop Windows host path mapping' {
        $containers.web.Mounts[0].Source = '/run/desktop/mnt/host/d/synthetic/AgentTools/PowerLoom/skills'
        { Assert-DeploymentCheckout $deploymentRoot } | Should -Not -Throw
    }
    It 'refuses missing container checkout metadata rather than guessing ownership' {
        $containers.mcp.Config.Labels.Clear()
        { Assert-DeploymentCheckout $deploymentRoot } | Should -Throw '*checkout differs*'
    }
    It 'refuses an unexpected bind left on a service not being recreated' {
        $containers['agent-runner'].Mounts += @{ Type = 'bind'; Source = 'D:/other'; Destination = '/other' }
        { Assert-DeploymentCheckout $deploymentRoot } | Should -Throw '*bind sets differ*'
    }
}
