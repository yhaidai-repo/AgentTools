<#
.SYNOPSIS
Exports new Inbox mails whose subject matches into PowerLoom's import inbox (outlook folder) for the outlook import source.

.DESCRIPTION
Read only: mails are never marked, moved or answered. Uses the running classic Outlook and does nothing when it is
closed, unless -StartOutlook is given: then it starts Outlook headless (no window), waits up to -StartWaitSeconds for
its Exchange connection and again for a send/receive, and exports.
Each mail becomes one JSON file (raw mail facts); PowerLoom's worker maps it to a PBI import request.
Needs Windows PowerShell 5.1 (powershell.exe): PowerShell 7 can't attach to a running Outlook.
#>
[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$OutputPath = (Join-Path $PSScriptRoot "..\..\import-inbox\outlook"),
    [string[]]$Subjects = @("Backlog Refinement", "Sprint Planning"),
    [int]$MaxPerRun = 50,
    [int]$LookbackDays = 14,
    [switch]$StartOutlook,
    [int]$StartWaitSeconds = 60
)

$ErrorActionPreference = "Stop"

$StatePath = Join-Path $PSScriptRoot "state.json"
$LogPath = Join-Path $PSScriptRoot "export.log"
$OlFolderInbox = 6
# Meeting items have no HTMLBody; their HTML body is in this MAPI property.
$PrHtml = "http://schemas.microsoft.com/mapi/proptag/0x10130102"
$PrInternetMessageId = "http://schemas.microsoft.com/mapi/proptag/0x1035001F"
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false
$BusyAttempts = 3
$BusyWaitSeconds = 10
$StartPollSeconds = 1
# Exchange connection modes in which new mail can be fetched: no Exchange (nothing to connect), cached and connected
# (headers, drizzle, full), online.
$ReadyConnectionModes = 0, 500, 600, 700, 800
$SendReceiveSource = Join-Path $PSScriptRoot "SendReceive.cs"
$OutlookInterop = "Microsoft.Office.Interop.Outlook, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c"

function Write-Log([string]$Message) {
    Add-Content -Path $LogPath -Value ("{0:u} {1}" -f (Get-Date), $Message)
}

function Get-RunningOutlook {
    if (-not (Get-Process OUTLOOK -ErrorAction SilentlyContinue)) {
        return $null
    }

    return [Runtime.InteropServices.Marshal]::GetActiveObject("Outlook.Application")
}

function Wait-ForExchangeConnection($Session) {
    $deadline = (Get-Date).AddSeconds($StartWaitSeconds)

    do {
        Start-Sleep -Seconds $StartPollSeconds
        $connected = $ReadyConnectionModes -contains $Session.ExchangeConnectionMode
    } while (-not $connected -and (Get-Date) -lt $deadline)

    return $connected
}

# Late-bound COM gives PowerShell no Outlook events, so the end of the send/receive is awaited in C# on the interop types.
function Invoke-SendReceive($Session) {
    if ($Session.SyncObjects.Count -eq 0) {
        return $true
    }

    Add-Type -Path $SendReceiveSource -ReferencedAssemblies $OutlookInterop

    return [SendReceive]::Run($Session.SyncObjects.Item(1), $StartWaitSeconds)
}

# Started through COM, classic Outlook runs without a window and closes by itself about 10 s after this script ends.
# It is still offline right after the start: it connects to Exchange within seconds, then a send/receive fetches the
# mail that came while it was closed.
function Start-HeadlessOutlook {
    $outlook = New-Object -ComObject Outlook.Application
    $session = $outlook.GetNamespace("MAPI")

    # Default profile, no dialog: nobody is there to answer one.
    $session.Logon("", "", $false, $false)

    if (-not (Wait-ForExchangeConnection $session)) {
        Write-Log "Started Outlook headless; it didn't connect to Exchange within $StartWaitSeconds s, so only mail it already had is exported."
    }
    elseif (-not (Invoke-SendReceive $session)) {
        Write-Log "Started Outlook headless; send/receive didn't finish within $StartWaitSeconds s, so only mail fetched so far is exported."
    }

    return $outlook
}

function Get-Outlook {
    $outlook = Get-RunningOutlook

    if ($outlook -or -not $StartOutlook) {
        return $outlook
    }

    return Start-HeadlessOutlook
}

# Entry id -> received time of every mail already exported, so a mail is written once.
function Read-State {
    $state = @{}

    if (-not (Test-Path $StatePath)) {
        return $state
    }

    (Get-Content $StatePath -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $state[$_.Name] = $_.Value }

    return $state
}

# Entries older than the lookback can't come back, so they are dropped.
function Save-State([hashtable]$State, [datetime]$Cutoff) {
    $kept = @{}

    $State.GetEnumerator() | Where-Object { [datetime]$_.Value -ge $Cutoff } | ForEach-Object { $kept[$_.Key] = $_.Value }
    [System.IO.File]::WriteAllText($StatePath, ($kept | ConvertTo-Json -Compress), $Utf8NoBom)
}

function Test-SubjectMatches([string]$Subject) {
    $matching = $Subjects | Where-Object { $Subject -like "*$_*" }

    return @($matching).Count -gt 0
}

function Test-IsNewMatch($Item, [hashtable]$State) {
    return (-not $State.ContainsKey($Item.EntryID)) -and (Test-SubjectMatches $Item.Subject)
}

# Restrict takes the date in the PC's regional format ("g" = short date and time).
function Get-NewMails($Inbox, [hashtable]$State, [datetime]$Cutoff) {
    $items = $Inbox.Items.Restrict(("[ReceivedTime] >= '{0}'" -f $Cutoff.ToString("g")))

    $items.Sort("[ReceivedTime]", $false)

    return @($items | Where-Object { Test-IsNewMatch $_ $State } | Select-Object -First $MaxPerRun)
}

function Get-MapiProperty($Item, [string]$Tag) {
    try {
        return $Item.PropertyAccessor.GetProperty($Tag)
    }
    catch {
        return $null
    }
}

function Get-MailHtml($Item) {
    if ($Item.HTMLBody) {
        return $Item.HTMLBody
    }

    $bytes = Get-MapiProperty $Item $PrHtml

    if (-not $bytes) {
        return $null
    }

    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function ConvertTo-MailRecord($Item) {
    return [ordered]@{
        entryId           = $Item.EntryID
        internetMessageId = Get-MapiProperty $Item $PrInternetMessageId
        subject           = $Item.Subject
        sender            = $Item.SenderName
        received          = $Item.ReceivedTime.ToUniversalTime().ToString("o")
        messageClass      = $Item.MessageClass
        html              = Get-MailHtml $Item
        text              = $Item.Body
    }
}

function Get-ShortHash([string]$Text) {
    $bytes = [System.Security.Cryptography.SHA1]::Create().ComputeHash($Utf8NoBom.GetBytes($Text))

    return [System.BitConverter]::ToString($bytes).Replace("-", "").Substring(0, 10)
}

# Written as .json.tmp, then renamed, so the worker never reads half a file.
function Write-MailFile($Record) {
    $name = "{0:yyyyMMdd-HHmmss}-{1}.json" -f ([datetime]$Record.received), (Get-ShortHash $Record.entryId)
    $temp = Join-Path $OutputPath "$name.tmp"

    [System.IO.File]::WriteAllText($temp, ($Record | ConvertTo-Json -Compress), $Utf8NoBom)
    Move-Item -Path $temp -Destination (Join-Path $OutputPath $name) -Force
}

function Export-Mail($Item, [hashtable]$State) {
    $record = ConvertTo-MailRecord $Item

    Write-MailFile $record
    $State[$record.entryId] = $record.received
}

function Export-NewMails($Outlook) {
    New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

    $cutoff = (Get-Date).AddDays(-$LookbackDays)
    $state = Read-State
    $inbox = $Outlook.GetNamespace("MAPI").GetDefaultFolder($OlFolderInbox)
    # PowerShell unrolls a one-item array returned from a function, so it is wrapped again here.
    $mails = @(Get-NewMails $inbox $state $cutoff)

    $mails | ForEach-Object { Export-Mail $_ $state }
    Save-State $state $cutoff

    return $mails.Count
}

# Outlook rejects calls while it is busy (starting, syncing, a dialog open): RPC_E_CALL_REJECTED. Tried again a few
# times, then left to the next scheduled run.
function Test-IsOutlookBusy($ErrorRecord) {
    return $ErrorRecord.Exception.HResult -eq 0x80010001 -or $ErrorRecord.Exception.InnerException.HResult -eq 0x80010001
}

# The number of exported mails, or $null when Outlook was busy and another attempt is left.
function Invoke-ExportAttempt($Outlook, [int]$Attempt) {
    try {
        return Export-NewMails $Outlook
    }
    catch {
        if (-not (Test-IsOutlookBusy $_) -or $Attempt -ge $BusyAttempts) {
            throw
        }

        Start-Sleep -Seconds $BusyWaitSeconds

        return $null
    }
}

function Invoke-Export($Outlook) {
    $attempt = 0

    do {
        $attempt++
        $exported = Invoke-ExportAttempt $Outlook $attempt
    } while ($null -eq $exported)

    return $exported
}

try {
    $outlook = Get-Outlook

    if (-not $outlook) {
        Write-Log "Outlook isn't running; nothing exported."
        return
    }

    Write-Log "Exported $(Invoke-Export $outlook) mail(s)."
}
catch {
    $hint = ""

    if (Test-IsOutlookBusy $_) {
        $hint = " Outlook is busy or has a dialog open."
    }

    Write-Log "Failed: $($_.Exception.Message)$hint"
    exit 1
}
