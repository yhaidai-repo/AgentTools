function New-UsageRecord {
    param(
        [Parameter(Mandatory)][datetime]$Timestamp,
        [Parameter(Mandatory)][string]$File,
        [Parameter(Mandatory)][ValidateSet('read', 'search', 'write', 'shell')][string]$Kind,
        [Parameter(Mandatory)][string]$Agent,
        [string]$Subagent,
        [string]$Session,
        [string]$Source,
        [string]$EventId
    )

    return [pscustomobject][ordered]@{
        ts       = $Timestamp.ToUniversalTime().ToString('o')
        file     = $File
        kind     = $Kind
        agent    = $Agent
        subagent = ConvertTo-OptionalValue -Value $Subagent
        session  = ConvertTo-OptionalValue -Value $Session
        source   = ConvertTo-OptionalValue -Value $Source
        eventId  = ConvertTo-OptionalValue -Value $EventId
    }
}

function ConvertTo-OptionalValue {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    return $Value
}
