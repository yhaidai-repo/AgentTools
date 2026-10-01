function New-CaptureProject {
    param(
        [Parameter(Mandatory)][string]$Key,
        [Parameter(Mandatory)][string]$Vault,
        [Parameter(Mandatory)][string]$RepoPath
    )

    return [pscustomobject]@{
        Key      = $Key
        Vault    = $Vault
        RepoPath = $RepoPath
    }
}
