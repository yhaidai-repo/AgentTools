function Read-DraftFile {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Root, [string]$ScopeRoot)

    Assert-VaultFilePath -Root $Root -Path $Path -ScopeRoot $ScopeRoot

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
        [Parameter(Mandatory)][string]$Root,
        [string]$ScopeRoot,
        [Parameter(Mandatory)][AllowEmptyString()][string[]]$Lines,
        [string]$NewLine = "`n"
    )

    Assert-VaultFilePath -Root $Root -Path $Path -ScopeRoot $ScopeRoot
    New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
    Assert-VaultFilePath -Root $Root -Path $Path -ScopeRoot $ScopeRoot
    $temporary = Join-Path (Split-Path -Parent $Path) ".$([IO.Path]::GetFileName($Path)).$([guid]::NewGuid().ToString('N')).tmp"
    try {
        Assert-VaultFilePath -Root $Root -Path $temporary -ScopeRoot $ScopeRoot
        [IO.File]::WriteAllText($temporary, ($Lines -join $NewLine) + $NewLine, [Text.UTF8Encoding]::new($false))
        Assert-VaultFilePath -Root $Root -Path $Path -ScopeRoot $ScopeRoot
        Publish-DraftFile -Temporary $temporary -Path $Path
    }
    finally {
        if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    }
}

function Publish-DraftFile([string]$Temporary, [string]$Path) {
    [IO.File]::Move($Temporary, $Path, $true)
}
