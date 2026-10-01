function Get-VaultRules {
    [CmdletBinding()]
    param(
        [string]$Cwd,
        [string]$Source = 'session finding',
        [object]$Config
    )

    $rules = Get-CaptureRules
    $vaults = Get-CaptureVault -Config $Config
    $sessionProject = Resolve-CaptureProject -Cwd $Cwd -Vaults $vaults
    $exampleProject = if ($sessionProject) { $sessionProject } else { @($vaults.Projects)[0] }

    return [pscustomobject][ordered]@{
        guidance       = @($rules.guidance)
        sessionProject = ConvertTo-ProjectInfo -Project $sessionProject
        vaults         = @($vaults | ForEach-Object { ConvertTo-VaultInfo -Vault $_ })
        draft          = $rules.draft
        capture        = [pscustomobject][ordered]@{
            command = Get-CaptureCommand
            example = Get-CaptureExample -Project $exampleProject -IsSessionProject ([bool]$sessionProject) -Source $Source
        }
    }
}

function ConvertTo-ProjectInfo {
    param([object]$Project)

    if (-not $Project) {
        return $null
    }

    return [pscustomobject][ordered]@{ vault = $Project.Vault; project = $Project.Key; repo = $Project.RepoPath }
}

function ConvertTo-VaultInfo {
    param([Parameter(Mandatory)][object]$Vault)

    return [pscustomobject][ordered]@{
        name     = $Vault.Name
        projects = @($Vault.Projects | ForEach-Object { ConvertTo-ProjectInfo -Project $_ })
    }
}

function Get-CaptureCommand {
    $cliPath = (Join-Path $script:ModuleRoot 'vault-capture.ps1').Replace('\', '/')

    return "pwsh -NoProfile -File `"$cliPath`" capture"
}

# With a known session project the agent leaves out vault and project; they are filled from the working directory.
function Get-CaptureExample {
    param(
        [object]$Project,
        [bool]$IsSessionProject,
        [string]$Source = 'session finding'
    )

    $key = if ($Project) { $Project.Key } else { 'key' }
    $example = [ordered]@{}

    if (-not $IsSessionProject) {
        $example.vault = if ($Project) { $Project.Vault } else { 'vault-name' }
        $example.project = $key
    }

    $example.name = "$key-short-topic"
    $example.title = 'Short topic (draft)'
    $example.source = $Source
    $example.target = '[[note]] or folder where the facts belong'
    $example.captured = @('One fact per bullet, as found.')
    $example.sections = [pscustomobject]@{ Decisions = @('Optional extra section: heading -> bullets.') }
    $example.assumptions = @('Optional.')
    $example.toFill = @('What still needs verification.')

    return [pscustomobject]$example
}
