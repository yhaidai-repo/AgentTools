<#
.SYNOPSIS
Creates (or with -Unregister removes) the Windows scheduled task that runs Export-PowerLoomMail.ps1 every few minutes while
you are logged on. Runs hidden, as you, without admin rights. -StartOutlook makes each run start classic Outlook headless
(no window) when it is closed.
#>
param(
    [int]$IntervalMinutes = 15,
    [string[]]$Subjects = @("Backlog Refinement", "Sprint Planning"),
    [string]$OutputPath = "",
    [switch]$StartOutlook,
    [switch]$Unregister
)

$ErrorActionPreference = "Stop"

$TaskName = "PowerLoom Outlook export"

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    "Removed the task '$TaskName'."
    return
}

$script = Join-Path $PSScriptRoot "Export-PowerLoomMail.ps1"
$subjectList = ($Subjects | ForEach-Object { "'$_'" }) -join ","
$output = ""

if ($OutputPath) {
    $output = " -OutputPath '$OutputPath'"
}

$start = ""

if ($StartOutlook) {
    $start = " -StartOutlook"
}

# conhost --headless keeps a console window from flashing up on every run.
$arguments = "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -Command `"& '$script' -Subjects $subjectList$output$start`""

$action = New-ScheduledTaskAction -Execute "conhost.exe" -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
"Registered '$TaskName': every $IntervalMinutes min, subjects $subjectList$start."
