function ConvertTo-NativePath {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$BasePath
    )

    $expandedPath = Expand-HomePath -Path (ConvertFrom-PosixDrivePath -Path $Path)
    $absoluteBase = Get-AbsoluteBasePath -BasePath $BasePath

    return [IO.Path]::GetFullPath($expandedPath, $absoluteBase)
}

function Get-AbsoluteBasePath {
    param([string]$BasePath)

    if ([string]::IsNullOrWhiteSpace($BasePath)) {
        return (Get-Location -PSProvider FileSystem).ProviderPath
    }

    return [IO.Path]::GetFullPath((Expand-HomePath -Path (ConvertFrom-PosixDrivePath -Path $BasePath)))
}

# Git Bash on Windows writes drive paths as /d/folder; .NET needs D:/folder.
function ConvertFrom-PosixDrivePath {
    param([Parameter(Mandatory)][string]$Path)

    $isPosixDrivePath = $IsWindows -and $Path -match '^/(?<drive>[A-Za-z])(?<rest>/.*)?$'
    if (-not $isPosixDrivePath) {
        return $Path
    }

    $rest = if ($Matches.rest) { $Matches.rest } else { '/' }

    return "$($Matches.drive):$rest"
}

function Expand-HomePath {
    param([Parameter(Mandatory)][string]$Path)

    $isHomePath = $Path -eq '~' -or $Path -match '^~[\\/]'
    if (-not $isHomePath) {
        return $Path
    }

    return $HOME + $Path.Substring(1)
}
