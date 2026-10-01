function Test-CaptureRequest {
    param(
        [Parameter(Mandatory)][object]$Request,
        [Parameter(Mandatory)][object]$Vault,
        [Parameter(Mandatory)][object]$Rules,
        [AllowEmptyString()][string[]]$ExistingDraft
    )

    $errors = @(
        Test-NoteName -Request $Request -Vault $Vault -Rules $Rules
        Test-ProjectKey -Request $Request -Vault $Vault
        Test-HasBullets -Request $Request
        Test-NoNotePath -Request $Request -Rules $Rules
    )

    if ($ExistingDraft) {
        $errors += Test-AppendTarget -Request $Request -ExistingDraft $ExistingDraft
    }
    else {
        $errors += Test-NewDraft -Request $Request -Rules $Rules
    }

    return @($errors | Where-Object { $_ })
}

function Test-NoteName {
    param(
        [Parameter(Mandatory)][object]$Request,
        [Parameter(Mandatory)][object]$Vault,
        [Parameter(Mandatory)][object]$Rules
    )

    if ($Request.Name -cnotmatch $Rules.draft.namePattern) {
        return "name '$($Request.Name)' must be kebab-case, e.g. '$($Request.Project)-short-topic'."
    }

    $clash = Find-NoteOutsideDraft -Vault $Vault -Name $Request.Name -Rules $Rules
    if ($clash) {
        return "name '$($Request.Name)' is already used by '$($clash.FullName)'. Note names are unique per vault."
    }
}

function Test-ProjectKey {
    param(
        [Parameter(Mandatory)][object]$Request,
        [Parameter(Mandatory)][object]$Vault
    )

    if (@($Vault.Projects.Key) -notcontains $Request.Project) {
        return "project '$($Request.Project)' is not in vault '$($Vault.Name)'. Known: $(@($Vault.Projects.Key) -join ', ')."
    }
}

function Test-HasBullets {
    param([Parameter(Mandatory)][object]$Request)

    if ($Request.Sections.Count -eq 0) {
        return 'nothing to save: give at least one bullet in captured.'
    }
}

# Vault notes link by [[name]]. A file path is not a link, and usage tracking would also count it as a use of that note.
function Test-NoNotePath {
    param(
        [Parameter(Mandatory)][object]$Request,
        [Parameter(Mandatory)][object]$Rules
    )

    $texts = @($Request.Title, $Request.Target) + @($Request.Sections.Values | ForEach-Object { $_ })
    $notePaths = @($texts |
        Where-Object { $_ } |
        ForEach-Object { [regex]::Matches($_, $Rules.draft.notePathPattern).Value } |
        Sort-Object -Unique)

    if ($notePaths.Count -gt 0) {
        return "use [[note]] links instead of file paths: $($notePaths -join ', ')."
    }
}

function Test-NewDraft {
    param(
        [Parameter(Mandatory)][object]$Request,
        [Parameter(Mandatory)][object]$Rules
    )

    $isKnownSource = @($Rules.draft.sourcePatterns | Where-Object { $Request.Source -match $_ }).Count -gt 0

    $checks = @(
        @{ Passed = [bool]$Request.Title; Error = 'title is required for a new draft.' }
        @{ Passed = [bool]$Request.Target; Error = 'target is required for a new draft: "[[note]]" or a folder where the facts belong.' }
        @{ Passed = $isKnownSource; Error = 'source must be "user message", "session finding" or "spec <id>".' }
        @{ Passed = $Request.Sections.Contains($Rules.draft.firstSection); Error = 'captured needs at least one bullet for a new draft.' }
    )

    return Get-FailedCheckError -Checks $checks
}

function Test-AppendTarget {
    param(
        [Parameter(Mandatory)][object]$Request,
        [Parameter(Mandatory)][AllowEmptyString()][string[]]$ExistingDraft
    )

    $type = Get-FrontmatterValue -Lines $ExistingDraft -Key 'type'
    $project = Get-FrontmatterValue -Lines $ExistingDraft -Key 'project'

    $checks = @(
        @{ Passed = $type -eq 'draft'; Error = "existing note '$($Request.Name)' is not a draft (type: $type); only drafts can be appended." }
        @{ Passed = $project -eq $Request.Project; Error = "existing draft belongs to project '$project', not '$($Request.Project)'." }
    )

    return Get-FailedCheckError -Checks $checks
}

function Get-FailedCheckError {
    param([Parameter(Mandatory)][hashtable[]]$Checks)

    return @($Checks | Where-Object { -not $_.Passed } | ForEach-Object { $_.Error })
}

function Get-FrontmatterValue {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][AllowEmptyCollection()][string[]]$Lines,
        [Parameter(Mandatory)][string]$Key
    )

    $keyPattern = "^$([regex]::Escape($Key)):\s*"
    $line = Get-FrontmatterLine -Lines $Lines | Where-Object { $_ -match $keyPattern } | Select-Object -First 1

    return ([string]$line -replace $keyPattern, '').Trim().Trim('"')
}

function Get-FrontmatterLine {
    param([Parameter(Mandatory)][AllowEmptyString()][AllowEmptyCollection()][string[]]$Lines)

    $hasFrontmatter = $Lines.Count -gt 0 -and $Lines[0] -eq '---'
    if (-not $hasFrontmatter) {
        return @()
    }

    $closingIndex = [array]::IndexOf($Lines, '---', 1)

    return $Lines[1..([Math]::Max(1, $closingIndex - 1))]
}
