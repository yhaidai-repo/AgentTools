function Read-DraftFile {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }

    $text = [IO.File]::ReadAllText($Path)

    return [pscustomobject]@{
        Lines   = $text.TrimEnd("`r", "`n") -split '\r?\n'
        NewLine = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
    }
}

# Vault notes are UTF-8 without BOM; an appended draft keeps its own line endings.
function Write-DraftFile {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][AllowEmptyString()][string[]]$Lines,
        [string]$NewLine = "`n"
    )

    New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
    [IO.File]::WriteAllText($Path, ($Lines -join $NewLine) + $NewLine, [Text.UTF8Encoding]::new($false))
}
