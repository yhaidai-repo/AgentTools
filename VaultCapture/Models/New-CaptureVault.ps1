function New-CaptureVault {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Root,
        [object[]]$Projects = @()
    )

    return [pscustomobject]@{
        Name     = $Name
        Root     = $Root
        Projects = @($Projects)
    }
}
