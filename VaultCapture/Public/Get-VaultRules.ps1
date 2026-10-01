function Get-VaultRules {
    [CmdletBinding()]
    param([object]$Config)

    $rules = Get-CaptureRules
    $vaults = Get-CaptureVault -Config $Config

    return [pscustomobject][ordered]@{
        guidance = @($rules.guidance)
        vaults   = @($vaults | ForEach-Object { [pscustomobject][ordered]@{ name = $_.Name; projects = $_.Projects } })
        draft    = $rules.draft
        capture  = [pscustomobject][ordered]@{
            command = Get-CaptureCommand
            example = Get-CaptureExample -Vault ($vaults | Select-Object -First 1)
        }
    }
}

function Get-CaptureCommand {
    $cliPath = (Join-Path $script:ModuleRoot 'vault-capture.ps1').Replace('\', '/')

    return "pwsh -NoProfile -File `"$cliPath`" capture"
}

function Get-CaptureExample {
    param([object]$Vault)

    $project = if ($Vault -and $Vault.Projects) { $Vault.Projects[0] } else { 'key' }

    return [pscustomobject][ordered]@{
        vault       = if ($Vault) { $Vault.Name } else { 'vault-name' }
        project     = $project
        name        = "$project-short-topic"
        title       = 'Short topic (draft)'
        source      = 'session finding'
        target      = '[[note]] or folder where the facts belong'
        captured    = @('One fact per bullet, as found.')
        sections    = [pscustomobject]@{ Decisions = @('Optional extra section: heading -> bullets.') }
        assumptions = @('Optional.')
        toFill      = @('What still needs verification.')
        agent       = 'your-agent-name'
        session     = 'your-session-id'
    }
}
