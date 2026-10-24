function Add-UsageLine {
    param(
        [Parameter(Mandatory)][string]$LogPath,
        [Parameter(Mandatory)][string]$Line
    )

    # Parallel agents and subagents append to the same log. AppendAllText locks the file, so a busy log is retried.
    $maxAttempts = 10

    New-Item -ItemType Directory -Path (Split-Path -Parent $LogPath) -Force | Out-Null
    $isWritten = Invoke-LineAppend -LogPath $LogPath -Line $Line

    for ($attempt = 1; -not $isWritten -and $attempt -lt $maxAttempts; $attempt++) {
        Start-Sleep -Milliseconds (25 * $attempt)
        $isWritten = Invoke-LineAppend -LogPath $LogPath -Line $Line
    }

    if (-not $isWritten) {
        throw "Could not append to '$LogPath' after $maxAttempts attempts."
    }
}

function Invoke-LineAppend {
    param(
        [Parameter(Mandatory)][string]$LogPath,
        [Parameter(Mandatory)][string]$Line
    )

    try {
        [IO.File]::AppendAllText($LogPath, $Line + "`n")

        return $true
    }
    catch [IO.IOException] {
        return $false
    }
}
