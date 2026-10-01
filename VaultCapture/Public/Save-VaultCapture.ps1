function Save-VaultCapture {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$InputObject,
        [object]$Config
    )

    $rules = Get-CaptureRules
    $vaults = Get-CaptureVault -Config $Config
    $request = ConvertFrom-CaptureInput -InputObject $InputObject -Rules $rules
    $vault = Resolve-CaptureVault -Name $request.Vault -Vaults $vaults
    if (-not $vault) {
        return New-CaptureResult -Errors "vault '$($request.Vault)' is unknown. Known: $($vaults.Name -join ', ')."
    }

    $path = Join-Path $vault.Root $rules.draft.folder "$($request.Name).md"
    $existing = Read-DraftFile -Path $path
    $errors = Test-CaptureRequest -Request $request -Vault $vault -Rules $rules -ExistingDraft $existing.Lines
    if ($errors) {
        return New-CaptureResult -Path $path -Errors $errors
    }

    $lines = Get-DraftContent -Request $request -Rules $rules -Existing $existing
    if ($lines.Count -gt $rules.draft.maxLines) {
        return New-CaptureResult -Path $path -Errors "draft would have $($lines.Count) lines (max $($rules.draft.maxLines)). Split the topic into a second draft."
    }

    Write-DraftFile -Path $path -Lines $lines -NewLine $(if ($existing) { $existing.NewLine } else { "`n" })
    Register-CaptureUsage -Path $path -Request $request -Config $Config

    return New-CaptureResult -Path $path -Mode $(if ($existing) { 'appended' } else { 'created' })
}

function Get-DraftContent {
    param(
        [Parameter(Mandatory)][object]$Request,
        [Parameter(Mandatory)][object]$Rules,
        [object]$Existing
    )

    if ($Existing) {
        return Add-DraftSection -Lines $Existing.Lines -Sections $Request.Sections -Rules $Rules
    }

    return ConvertTo-DraftLine -Request $Request -Rules $Rules -CapturedAt (Get-Date)
}

# Usage logging must never undo a saved capture, so a logging failure is only a warning.
function Register-CaptureUsage {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][object]$Request,
        [object]$Config
    )

    $agent = if ($Request.Agent) { $Request.Agent } else { 'unknown' }

    try {
        Add-VaultUsage -Path $Path -Kind write -Agent $agent -Session $Request.Session -Source 'vault-capture' -Config $Config | Out-Null
    }
    catch {
        Write-Warning "Capture saved, but usage was not logged: $_"
    }
}
