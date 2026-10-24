function New-ToolFileUse {
    param(
        [Parameter(Mandatory)][string]$Kind,
        [string[]]$Paths = @()
    )

    return [pscustomobject]@{
        Kind  = $Kind
        Paths = @($Paths | Where-Object { $_ })
    }
}
