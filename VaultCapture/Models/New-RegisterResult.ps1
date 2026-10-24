function New-RegisterResult {
    param(
        [object]$Records = $null,
        [string]$Id,
        [string]$Path,
        [string[]]$Errors = @()
    )

    return [pscustomobject][ordered]@{
        ok      = $Errors.Count -eq 0
        records = $Records
        id      = $Id
        path    = $Path
        errors  = @($Errors)
    }
}
