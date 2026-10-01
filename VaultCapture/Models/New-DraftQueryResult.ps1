function New-DraftQueryResult {
    param(
        [object]$Drafts = $null,
        [string[]]$Errors = @()
    )

    return [pscustomobject][ordered]@{
        ok     = $Errors.Count -eq 0
        drafts = $Drafts
        errors = @($Errors)
    }
}
