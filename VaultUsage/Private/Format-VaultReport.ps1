function Format-VaultReport {
    param(
        [Parameter(Mandatory)][object]$Report,
        [Parameter(Mandatory)][ValidateSet('object', 'markdown', 'json', 'csv')][string]$Format
    )

    switch ($Format) {
        'object' {
            return $Report
        }
        'json' {
            return $Report | ConvertTo-Json -Depth 5
        }
        'csv' {
            return ConvertTo-VaultNoteRow -Report $Report | ConvertTo-Csv -NoTypeInformation
        }
        'markdown' {
            return ConvertTo-UsageMarkdown -Report $Report
        }
    }
}

function ConvertTo-VaultNoteRow {
    param([Parameter(Mandatory)][object]$Report)

    $vaultName = Split-Path -Leaf $Report.Vault

    return $Report.Notes | Select-Object @{ Name = 'Vault'; Expression = { $vaultName } },
        File, Exists, Reads, Searches, Shell, Writes, Total, Sessions,
        @{ Name = 'LastUsed'; Expression = { ConvertTo-IsoDate -Date $_.LastUsed } },
        @{ Name = 'LastRead'; Expression = { ConvertTo-IsoDate -Date $_.LastRead } }
}

function ConvertTo-IsoDate {
    param([Nullable[datetime]]$Date)

    if (-not $Date) {
        return $null
    }

    return $Date.ToUniversalTime().ToString('o')
}
