function New-RegisterRecord {
    param(
        [Parameter(Mandatory)][string]$Id,
        [string]$Title,
        [string]$Status,
        [bool]$Resolved
    )

    return [pscustomobject][ordered]@{
        id       = $Id
        title    = $Title
        status   = $Status
        resolved = $Resolved
    }
}
