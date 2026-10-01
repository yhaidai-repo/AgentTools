function New-CaptureVault {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Root,
        [string[]]$Projects = @()
    )

    return [pscustomobject]@{
        Name     = $Name
        Root     = $Root
        Projects = @($Projects)
    }
}
