function Get-UsageLogPath {
    param(
        [Parameter(Mandatory)][string]$VaultRoot,
        [Parameter(Mandatory)][object]$Config
    )

    return Join-Path $VaultRoot $Config.logFolder $Config.logFile
}

function Read-UsageLog {
    param(
        [Parameter(Mandatory)][string]$VaultRoot,
        [Parameter(Mandatory)][object]$Config
    )

    $logPath = Get-UsageLogPath -VaultRoot $VaultRoot -Config $Config
    if (-not (Test-Path -LiteralPath $logPath -PathType Leaf)) {
        return @()
    }

    return @(Get-Content -LiteralPath $logPath |
        ForEach-Object { ConvertFrom-UsageLine -Line $_ -LogPath $logPath } |
        Where-Object { $_ })
}

function ConvertFrom-UsageLine {
    param(
        [string]$Line,
        [string]$LogPath
    )

    if ([string]::IsNullOrWhiteSpace($Line)) {
        return $null
    }

    try {
        return $Line | ConvertFrom-Json -DateKind Utc
    }
    catch {
        Write-Warning "Skipping unreadable line in '$LogPath': $Line"

        return $null
    }
}
