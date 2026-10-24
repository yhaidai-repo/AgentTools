function New-NoteUsage {
    param(
        [Parameter(Mandatory)][string]$File,
        [bool]$Exists,
        [int]$Reads,
        [int]$Searches,
        [int]$Shell,
        [int]$Writes,
        [int]$Sessions,
        [Nullable[datetime]]$LastUsed,
        [Nullable[datetime]]$LastRead
    )

    return [pscustomobject][ordered]@{
        File     = $File
        Exists   = $Exists
        Reads    = $Reads
        Searches = $Searches
        Shell    = $Shell
        Writes   = $Writes
        Total    = $Reads + $Searches + $Shell + $Writes
        Sessions = $Sessions
        LastUsed = $LastUsed
        LastRead = $LastRead
    }
}
