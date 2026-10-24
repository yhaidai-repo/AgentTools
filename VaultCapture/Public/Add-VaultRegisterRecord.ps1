# Appends a new open question or known issue with the next id, in the record layout of the vault rules (AGENTS.md):
# heading with id and title, metadata line with status and both dates, then the labelled blocks. The caller has the
# user's yes (the rule "ask the user first").
function Add-VaultRegisterRecord {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$InputObject,
        [object]$Config
    )

    $vaultInfo = Resolve-CaptureVault -Name $InputObject.vault -Vaults (Get-CaptureVault -Config $Config)
    $register = if ($vaultInfo) { Resolve-RegisterFile -Vault $vaultInfo -Project $InputObject.project -Kind $InputObject.kind } else { $null }
    $errors = @(Get-RegisterInputError -InputObject $InputObject -VaultInfo $vaultInfo -Register $register)
    if ($errors) {
        return New-RegisterResult -Errors $errors
    }

    $file = Read-DraftFile -Path $register.Path
    $id = Get-NextRegisterId -Records @(Get-RegisterRecordList -Lines $file.Lines -Prefix $register.Prefix) -Prefix $register.Prefix
    $record = ConvertTo-RegisterLine -InputObject $InputObject -Id $id -Label $register.Label -Date (Get-Date -Format 'yyyy-MM-dd')

    Write-DraftFile -Path $register.Path -Lines (@($file.Lines) + '' + $record) -NewLine $file.NewLine

    return New-RegisterResult -Id $id -Path $register.Path
}

function Get-RegisterInputError {
    param(
        [Parameter(Mandatory)][object]$InputObject,
        [object]$VaultInfo,
        [object]$Register
    )

    if (-not $VaultInfo) {
        return "vault '$($InputObject.vault)' is unknown."
    }

    if ($Register.Error) {
        return $Register.Error
    }

    return @(@('title', 'text') | Where-Object { [string]::IsNullOrWhiteSpace($InputObject.$_) } | ForEach-Object { "$_ is required." })
}

function ConvertTo-RegisterLine {
    param(
        [Parameter(Mandatory)][object]$InputObject,
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][string]$Date
    )

    $lines = @(
        "## $Id $($InputObject.title.Trim())"
        "> **Open** · Created $Date · Updated $Date"
        ''
        "**$Label**: $($InputObject.text.Trim())"
    )
    $lines += @(ConvertTo-RecordBlock -Label 'Default' -Items $InputObject.default -Numbered $false)
    $lines += @(ConvertTo-RecordBlock -Label 'Options' -Items $InputObject.options -Numbered $true)

    return $lines
}

function ConvertTo-RecordBlock {
    param(
        [Parameter(Mandatory)][string]$Label,
        [object[]]$Items,
        [bool]$Numbered
    )

    $entries = @($Items | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($entries.Count -eq 0) {
        return @()
    }

    $bullets = 0..($entries.Count - 1) | ForEach-Object { Format-RecordBullet -Entry $entries[$_] -Number ($_ + 1) -Numbered $Numbered }

    return @("**$Label**:") + $bullets
}

function Format-RecordBullet {
    param(
        [Parameter(Mandatory)][string]$Entry,
        [Parameter(Mandatory)][int]$Number,
        [bool]$Numbered
    )

    if ($Numbered) {
        return "$Number. $Entry"
    }

    return "- $Entry"
}
