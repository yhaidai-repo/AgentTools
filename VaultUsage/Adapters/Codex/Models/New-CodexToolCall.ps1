function New-CodexToolCall {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Name,
        [object]$ToolInput,
        [object]$ToolResponse,
        [string]$Cwd,
        [string]$Session,
        [datetime]$Timestamp = [datetime]::UtcNow
    )

    return [pscustomobject]@{
        Id           = $Id
        Name         = $Name
        ToolInput    = $ToolInput
        ToolResponse = $ToolResponse
        Cwd          = $Cwd
        Session      = $Session
        Subagent     = $null
        Timestamp    = $Timestamp
    }
}
