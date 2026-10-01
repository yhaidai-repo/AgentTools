function Get-CaptureInstruction {
    [CmdletBinding()]
    param(
        [string]$Reason = 'Save valuable information to the vault.',
        [string]$Cwd,
        [string]$Source = 'session finding',
        [object]$Config
    )

    $rules = Get-VaultRules -Cwd $Cwd -Source $Source -Config $Config

    $lines = @(
        $Reason
        'Save valuable new information from this session to the vault first. If nothing new is worth keeping, say so and continue.'
        ''
        'Vault rules:'
        ($rules.guidance | ForEach-Object { "- $_" })
        ''
        (Get-ProjectInstruction -Rules $rules)
        ''
        "Save each topic as a draft in <vault>/$($rules.draft.folder)/ with source `"$Source`". The same name appends bullets to that draft. Run the command from your working directory and pipe JSON to it:"
        "  $($rules.capture.command)"
        ($rules.capture.example | ConvertTo-Json -Depth 4 -Compress)
        'The command prints {ok, mode, path, errors}. If ok is false, fix the errors and run it again.'
    )

    return $lines -join [Environment]::NewLine
}

function Get-ProjectInstruction {
    param([Parameter(Mandatory)][object]$Rules)

    $project = $Rules.sessionProject
    if ($project) {
        return "This session works on project $($project.project) in vault $($project.vault) (repository $($project.repo)). Captures go there; leave out vault and project."
    }

    $projectLines = $Rules.vaults | ForEach-Object { "- $($_.name): $(@($_.projects.project) -join ', ')" }

    return @('The working directory is in no project repository. Pass vault and project:') + $projectLines
}
