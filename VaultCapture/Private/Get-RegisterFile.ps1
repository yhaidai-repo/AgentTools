# A project's registers: <project>/<project>-open-questions.md (OQ) and <project>/<project>-known-issues.md (KI).
$script:RegisterKinds = @{
    questions = @{ Suffix = 'open-questions'; Prefix = 'OQ'; Label = 'Question' }
    issues    = @{ Suffix = 'known-issues'; Prefix = 'KI'; Label = 'Issue' }
}

function Resolve-RegisterFile {
    param(
        [Parameter(Mandatory)][object]$Vault,
        [Parameter(Mandatory)][string]$Project,
        [Parameter(Mandatory)][string]$Kind
    )

    $kindInfo = $script:RegisterKinds[$Kind]
    if (-not $kindInfo) {
        return [pscustomobject]@{ Error = "kind '$Kind' is unknown. Use: $($script:RegisterKinds.Keys -join ', ')." }
    }

    $path = Join-Path $Vault.Root $Project "$Project-$($kindInfo.Suffix).md"
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return [pscustomobject]@{ Error = "project '$Project' has no $($kindInfo.Suffix) register." }
    }

    return [pscustomobject]@{ Path = $path; Prefix = $kindInfo.Prefix; Label = $kindInfo.Label; Error = $null }
}

# Records as the vault rules lay them out ("## [RESOLVED] OQ-001 Title" + "> **Status** · …"), and the older layout with
# the title as a bold line under a bare "## OQ-001" heading.
function Get-RegisterRecordList {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][AllowEmptyCollection()][string[]]$Lines,
        [Parameter(Mandatory)][string]$Prefix
    )

    $headingPattern = "^##\s+(?<resolved>\[RESOLVED\]\s+)?(?<id>$Prefix-\d+)\s*(?<title>.*)$"
    $headingIndexes = @(0..($Lines.Count - 1) | Where-Object { $Lines[$_] -match $headingPattern })

    return @($headingIndexes | ForEach-Object { ConvertTo-RegisterRecord -Lines $Lines -Index $_ -HeadingPattern $headingPattern })
}

function ConvertTo-RegisterRecord {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string[]]$Lines,
        [Parameter(Mandatory)][int]$Index,
        [Parameter(Mandatory)][string]$HeadingPattern
    )

    $null = $Lines[$Index] -match $HeadingPattern
    $heading = $Matches.Clone()
    $following = @($Lines | Select-Object -Skip ($Index + 1) -First 4)
    $title = Get-RecordTitle -HeadingTitle $heading.title -Following $following
    $metadata = $following | Where-Object { $_ -match '^>\s*\*\*[^*]+\*\*' } | Select-Object -First 1
    $status = if ($metadata) { ($metadata -replace '^>\s*\*\*([^*]+)\*\*.*$', '$1').Trim() } else { '' }

    return New-RegisterRecord -Id $heading.id -Title $title -Status $status -Resolved ([bool]$heading.resolved)
}

function Get-RecordTitle {
    param(
        [string]$HeadingTitle,
        [Parameter(Mandatory)][AllowEmptyString()][AllowEmptyCollection()][string[]]$Following
    )

    if ($HeadingTitle) {
        return $HeadingTitle.Trim()
    }

    $boldTitle = $Following | Where-Object { $_ -match '^\*\*[^*]+\*\*\s*$' } | Select-Object -First 1

    return ([string]$boldTitle -replace '^\*\*|\*\*\s*$', '').Trim()
}

function Get-NextRegisterId {
    param(
        [Parameter(Mandatory)][AllowEmptyCollection()][object[]]$Records,
        [Parameter(Mandatory)][string]$Prefix
    )

    $highest = ($Records | ForEach-Object { [int]($_.id -replace "^$Prefix-", '') } | Measure-Object -Maximum).Maximum
    $next = if ($highest) { $highest + 1 } else { 1 }

    return '{0}-{1:000}' -f $Prefix, $next
}
