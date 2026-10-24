function Measure-VaultUsage {
    param(
        [Parameter(Mandatory)][string]$VaultRoot,
        [Parameter(Mandatory)][object]$Config,
        [Nullable[datetime]]$Since
    )

    $notes = Get-VaultNote -VaultRoot $VaultRoot -Config $Config
    $records = @(Read-UsageLog -VaultRoot $VaultRoot -Config $Config | Where-Object { Test-RecordSince -Record $_ -Since $Since })
    $recordsByFile = Group-RecordByFile -Records $records
    $files = @($notes) + @($recordsByFile.Keys) | Sort-Object -Unique
    $noteUsage = @($files | ForEach-Object { Measure-NoteUsage -File $_ -Exists ($notes -contains $_) -Records $recordsByFile[$_] })

    return New-VaultReport -Vault $VaultRoot -GeneratedAt ([datetime]::UtcNow) -Since $Since -Notes $noteUsage
}

function Test-RecordSince {
    param(
        [Parameter(Mandatory)][object]$Record,
        [Nullable[datetime]]$Since
    )

    return -not $Since -or $Record.ts -ge $Since.ToUniversalTime()
}

function Group-RecordByFile {
    param([object[]]$Records)

    $recordsByFile = @{}

    foreach ($group in $Records | Group-Object -Property file) {
        $recordsByFile[$group.Name] = @($group.Group)
    }

    return $recordsByFile
}

function Measure-NoteUsage {
    param(
        [Parameter(Mandatory)][string]$File,
        [bool]$Exists,
        [object[]]$Records = @()
    )

    $reads = @($Records | Where-Object kind -EQ 'read')
    $sessions = @($Records.session | Where-Object { $_ } | Sort-Object -Unique)

    return New-NoteUsage -File $File -Exists $Exists `
        -Reads $reads.Count `
        -Searches (Get-KindCount -Records $Records -Kind 'search') `
        -Shell (Get-KindCount -Records $Records -Kind 'shell') `
        -Writes (Get-KindCount -Records $Records -Kind 'write') `
        -Sessions $sessions.Count `
        -LastUsed (Get-LatestTimestamp -Records $Records) `
        -LastRead (Get-LatestTimestamp -Records $reads)
}

function Get-KindCount {
    param(
        [object[]]$Records,
        [Parameter(Mandatory)][string]$Kind
    )

    return @($Records | Where-Object kind -EQ $Kind).Count
}

function Get-LatestTimestamp {
    param([object[]]$Records)

    return $Records.ts | Sort-Object -Descending | Select-Object -First 1
}
