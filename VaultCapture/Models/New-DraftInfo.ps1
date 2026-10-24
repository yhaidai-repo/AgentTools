function New-DraftInfo {
    param(
        [Parameter(Mandatory)][string]$Name,
        [string]$Title,
        [string]$Project,
        [string]$Captured,
        [string]$Source,
        [string]$Target,
        [Parameter(Mandatory)][string]$Path,
        [bool]$Preferred
    )

    return [pscustomobject][ordered]@{
        name      = $Name
        title     = $Title
        project   = $Project
        captured  = $Captured
        source    = $Source
        target    = $Target
        path      = $Path
        preferred = $Preferred
    }
}
