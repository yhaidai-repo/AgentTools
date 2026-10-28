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

    # Read, next id and write under the register's lock: two writers at once would lose a record or repeat an id.
    try { return Use-RegisterLock -Path $register.Path -Root $register.Root -Action { Add-RegisterLine -InputObject $InputObject -Register $register } }
    catch { return New-RegisterResult -Errors $_.Exception.Message }
}

function Add-RegisterLine {
    param(
        [Parameter(Mandatory)][object]$InputObject,
        [Parameter(Mandatory)][object]$Register
    )

    $file = Read-DraftFile -Path $Register.Path -Root $Register.Root -ScopeRoot (Split-Path -Parent $Register.Path)
    $id = Get-NextRegisterId -Records @(Get-RegisterRecordList -Lines $file.Lines -Prefix $Register.Prefix) -Prefix $Register.Prefix
    $record = ConvertTo-RegisterLine -InputObject $InputObject -Id $id -Label $Register.Label -Date (Get-Date -Format 'yyyy-MM-dd')

    Write-DraftFile -Path $Register.Path -Root $Register.Root -ScopeRoot (Split-Path -Parent $Register.Path) -Lines (@($file.Lines) + '' + $record) -NewLine $file.NewLine

    return New-RegisterResult -Id $id -Path $Register.Path
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

    $missing = @(@('title', 'text') | Where-Object { [string]::IsNullOrWhiteSpace($InputObject.$_) } | ForEach-Object { "$_ is required." })

    return $missing + @(Get-RegisterShapeError -InputObject $InputObject)
}

# A record is one heading and its lines: a line break in the title or a list entry, or a heading line in the text,
# would start a record (or a fake one) of its own.
function Get-RegisterShapeError {
    param([Parameter(Mandatory)][object]$InputObject)

    $entries = @($InputObject.default) + @($InputObject.options) | Where-Object { $_ }
    $errors = @()
    if ($InputObject.context) {
        $context = $InputObject.context
        if ($null -ne $context.pbiId -and ([string]$context.pbiId -notmatch '\A[1-9][0-9]*\z')) {
            $errors += 'context.pbiId is a positive integer.'
        }
        foreach ($field in @('taskId', 'chatId', 'sessionId')) {
            if ($null -ne $context.$field -and [string]$context.$field -notmatch '\A[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}\z') {
                $errors += "context.$field is an id without whitespace or Markdown (at most 200 characters)."
            }
        }
    }
    if ([string]$InputObject.title -match '[\r\n]') {
        $errors += 'title is one line.'
    }

    if (@($entries | Where-Object { [string]$_ -match '[\r\n]' }).Count -gt 0) {
        $errors += 'each default and option is one line.'
    }

    if ([string]$InputObject.text -match '(?m)^\s*#') {
        $errors += 'text has no heading lines (a line starting with #): it would start a record of its own.'
    }

    return $errors
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
    if ($InputObject.context) {
        $context = $InputObject.context
        $references = @()
        if ($context.pbiId) { $references += "pbi:$($context.pbiId)" }
        if ($context.taskId) { $references += "task:$($context.taskId)" }
        if ($context.chatId) { $references += "chat:$($context.chatId)" }
        elseif ($context.sessionId) { $references += "session:$($context.sessionId)" }
        if ($references.Count -gt 0) { $lines += "- Created in: $Date · $($references -join ' · ')" }
    }

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
