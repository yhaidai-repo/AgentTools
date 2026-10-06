function Save-VaultCapture {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$InputObject,
        [string]$Cwd,
        [object]$Config
    )

    $rules = Get-CaptureRules
    $vaults = Get-CaptureVault -Config $Config -Cwd $Cwd
    $request = ConvertFrom-CaptureInput -InputObject $InputObject -Rules $rules
    $projectError = Set-SessionProject -Request $request -Project (Resolve-CaptureProject -Cwd $Cwd -Vaults $vaults)
    if ($projectError) {
        return New-CaptureResult -Errors $projectError
    }

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

    $newLine = if ($existing) { $existing.NewLine } else { "`n" }
    $mode = if ($existing) { 'appended' } else { 'created' }

    Write-DraftFile -Path $path -Lines $lines -NewLine $newLine

    return New-CaptureResult -Path $path -Mode $mode
}

# An agent working inside a project's repository captures into that project only.
function Set-SessionProject {
    param(
        [Parameter(Mandatory)][object]$Request,
        [object]$Project
    )

    if (-not $Project) {
        return $null
    }

    $isOtherProject = ($Request.Project -and $Request.Project -ne $Project.Key) -or ($Request.Vault -and $Request.Vault -ne $Project.Vault)
    if ($isOtherProject) {
        return "this session works on project '$($Project.Key)' in vault '$($Project.Vault)'; leave out vault and project."
    }

    $Request.Vault = $Project.Vault
    $Request.Project = $Project.Key

    return $null
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
