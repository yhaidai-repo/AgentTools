function New-CaptureResult {
    param(
        [string]$Path,
        [ValidateSet('created', 'appended', 'rejected')][string]$Mode = 'rejected',
        [string[]]$Errors = @()
    )

    return [pscustomobject][ordered]@{
        ok     = $Errors.Count -eq 0
        mode   = $Mode
        path   = $Path
        errors = @($Errors)
    }
}
