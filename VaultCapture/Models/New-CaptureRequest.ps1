function New-CaptureRequest {
    param(
        [string]$Vault,
        [string]$Project,
        [string]$Name,
        [string]$Title,
        [string]$Source,
        [string]$Target,
        [Collections.Specialized.OrderedDictionary]$Sections = [ordered]@{}
    )

    return [pscustomobject]@{
        Vault    = $Vault
        Project  = $Project
        Name     = $Name
        Title    = $Title
        Source   = $Source
        Target   = $Target
        Sections = $Sections
    }
}
