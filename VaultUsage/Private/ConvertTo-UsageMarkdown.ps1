function ConvertTo-UsageMarkdown {
    param([Parameter(Mandatory)][object]$Report)

    $used = @($Report.Notes | Where-Object { $_.Exists -and $_.Total -gt 0 } | Sort-Object -Property @{ Expression = 'Total'; Descending = $true }, File)
    $neverUsed = @($Report.Notes | Where-Object { $_.Exists -and $_.Total -eq 0 })
    $missing = @($Report.Notes | Where-Object { -not $_.Exists })

    $lines = @(
        Get-MarkdownHeader -Report $Report -UsedCount $used.Count -NeverUsedCount $neverUsed.Count -MissingCount $missing.Count
        Get-MarkdownSection -Title 'Used notes' -Body (ConvertTo-UsageTable -Notes $used)
        Get-MarkdownSection -Title 'Never used' -Body ($neverUsed | ForEach-Object { "- ``$($_.File)``" })
        Get-MarkdownSection -Title 'Logged but missing (moved or deleted)' -Body (ConvertTo-UsageTable -Notes $missing)
    )

    return $lines -join [Environment]::NewLine
}

function Get-MarkdownHeader {
    param(
        [Parameter(Mandatory)][object]$Report,
        [int]$UsedCount,
        [int]$NeverUsedCount,
        [int]$MissingCount
    )

    $period = if ($Report.Since) { "since $(Format-UsageDate -Date $Report.Since)" } else { 'all time' }
    $noteCount = $UsedCount + $NeverUsedCount

    return @(
        "# Vault usage: $(Split-Path -Leaf $Report.Vault)"
        ''
        "``$($Report.Vault)`` · $period · generated $(Format-UsageDate -Date $Report.GeneratedAt)"
        ''
        "Notes: $noteCount · used: $UsedCount · never used: $NeverUsedCount · missing: $MissingCount"
        ''
        '`shell` = note path found in a shell command (read or write unknown). `search` = grep inside that file.'
    )
}

function Get-MarkdownSection {
    param(
        [Parameter(Mandatory)][string]$Title,
        [string[]]$Body
    )

    $content = if ($Body) { $Body } else { '_None._' }

    return @('', "## $Title", '') + $content
}

function ConvertTo-UsageTable {
    param([object[]]$Notes)

    if (-not $Notes) {
        return @()
    }

    $header = @(
        '| Note | Reads | Search | Shell | Writes | Sessions | Last used | Last read |'
        '|---|---:|---:|---:|---:|---:|---|---|'
    )

    return $header + ($Notes | ForEach-Object { ConvertTo-UsageTableRow -Note $_ })
}

function ConvertTo-UsageTableRow {
    param([Parameter(Mandatory)][object]$Note)

    $cells = @(
        "``$($Note.File)``"
        $Note.Reads
        $Note.Searches
        $Note.Shell
        $Note.Writes
        $Note.Sessions
        Format-UsageDate -Date $Note.LastUsed
        Format-UsageDate -Date $Note.LastRead
    )

    return '| ' + ($cells -join ' | ') + ' |'
}

function Format-UsageDate {
    param([Nullable[datetime]]$Date)

    if (-not $Date) {
        return ''
    }

    $localDate = if ($Date.Kind -eq [DateTimeKind]::Utc) { $Date.ToLocalTime() } else { $Date }

    return $localDate.ToString('yyyy-MM-dd HH:mm')
}
