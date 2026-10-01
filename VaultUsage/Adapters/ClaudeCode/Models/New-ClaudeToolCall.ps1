function New-ClaudeToolCall {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Name,
        [object]$ToolInput,
        [object]$ToolResponse,
        [string]$Cwd,
        [string]$Session,
        [string]$Subagent,
        [datetime]$Timestamp = [datetime]::UtcNow
    )

    return [pscustomobject]@{
        Id        = $Id
        Name      = $Name
        ToolInput    = $ToolInput
        ToolResponse = $ToolResponse
        Cwd          = $Cwd
        Session   = $Session
        Subagent  = $Subagent
        Timestamp = $Timestamp
    }
}
