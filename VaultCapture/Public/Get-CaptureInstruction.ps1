function Get-CaptureInstruction {
    [CmdletBinding()]
    param(
        [string]$Reason = 'Save valuable information to the vault.',
        [string]$Agent,
        [string]$Session,
        [object]$Config
    )

    $rules = Get-VaultRules -Config $Config
    $example = $rules.capture.example

    if ($Agent) {
        $example.agent = $Agent
    }

    if ($Session) {
        $example.session = $Session
    }

    $lines = @(
        $Reason
        'Save valuable new information from this session to the vault first. If nothing new is worth keeping, say so and continue.'
        ''
        'Vault rules:'
        ($rules.guidance | ForEach-Object { "- $_" })
        ''
        'Vaults and projects:'
        ($rules.vaults | ForEach-Object { "- $($_.name): $($_.projects -join ', ')" })
        ''
        "Save each topic as a draft in <vault>/$($rules.draft.folder)/. The same name appends bullets to that draft. Pipe JSON to:"
        "  $($rules.capture.command)"
        ($example | ConvertTo-Json -Depth 4 -Compress)
        'The command prints {ok, mode, path, errors}. If ok is false, fix the errors and run it again.'
    )

    return $lines -join [Environment]::NewLine
}
