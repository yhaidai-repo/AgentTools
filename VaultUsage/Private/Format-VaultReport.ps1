function Format-VaultReport {
    param(
        [Parameter(Mandatory)][object[]]$Reports,
        [Parameter(Mandatory)][ValidateSet('object', 'markdown', 'json', 'csv')][string]$Format
    )

    switch ($Format) {
        'object' {
            return $Reports
        }
        'json' {
            return $Reports | ConvertTo-Json -Depth 5
        }
        'csv' {
            return $Reports | ForEach-Object { ConvertTo-VaultNoteRow -Report $_ } | ConvertTo-Csv -NoTypeInformation
        }
        'markdown' {
            return ($Reports | ForEach-Object { ConvertTo-UsageMarkdown -Report $_ }) -join ([Environment]::NewLine * 2)
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
