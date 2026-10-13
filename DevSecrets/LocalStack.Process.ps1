# Processes of a local stack: build, start with environment, readiness, logs, stop (dot-sourced).

$FailureLogLines = 30
$PollSeconds = 2
$StdHandleIds = @(-10, -11, -12)
$HandleFlagInherit = 1

Add-Type -Namespace DevSecrets -Name StdHandles -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern System.IntPtr GetStdHandle(int nStdHandle);
[DllImport("kernel32.dll")] public static extern bool SetHandleInformation(System.IntPtr hObject, uint dwMask, uint dwFlags);
'@

function Build-Project([string] $ProjectPath) {
    Write-Host "Building $ProjectPath"
    $output = dotnet build $ProjectPath -nologo -v q -clp:ErrorsOnly 2>&1

    if ($LASTEXITCODE -ne 0) {
        $output | Select-Object -Last $FailureLogLines | ForEach-Object { Write-Host "  $_" }

        throw "Build failed: $ProjectPath"
    }
}

function Set-ProcessEnvironment([hashtable] $Environment, [bool] $Enabled) {
    foreach ($entry in $Environment.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, $(if ($Enabled) { $entry.Value } else { $null }))
    }
}

function Set-StdHandlesInheritable([bool] $Inheritable) {
    # A started service would otherwise inherit this shell's output pipe and keep it open: a caller reading the
    # script's output to the end (an agent tool, `| tail`) would wait until the stack stops.
    foreach ($id in $StdHandleIds) {
        [DevSecrets.StdHandles]::SetHandleInformation([DevSecrets.StdHandles]::GetStdHandle($id), $HandleFlagInherit, [uint] $Inheritable) | Out-Null
    }
}

function Start-ServiceProcess([string] $Name, [hashtable] $Service, [string] $ProjectPath, [hashtable] $Environment) {
    $run = $Service.run
    $log = Join-Path $StackDir "$Name.log"
    $errorLog = Join-Path $StackDir "$Name.err.log"
    $arguments = @("run", "--no-build", "--project", $ProjectPath, "--launch-profile", $run.launchProfile)

    # The child inherits the environment of this process; Hidden gives it its own console, so it outlives this shell.
    Set-ProcessEnvironment $Environment $true
    Set-StdHandlesInheritable $false

    try {
        $process = Start-Process dotnet -ArgumentList $arguments -WorkingDirectory (Split-Path $ProjectPath) `
            -RedirectStandardOutput $log -RedirectStandardError $errorLog -WindowStyle Hidden -PassThru
    }
    finally {
        Set-StdHandlesInheritable $true
        Set-ProcessEnvironment $Environment $false
    }

    Write-Host "Started $Name (pid $($process.Id))"

    return @{
        name = $Name
        kind = "process"
        pid = $process.Id
        startedTicks = $process.StartTime.Ticks
        log = $log
        errorLog = $errorLog
        url = $Service.localUrl
        readyLog = $run.readyLog
        readyProcess = $run.readyProcess
    }
}

function Test-EntryAlive([hashtable] $Entry) {
    if ($Entry.kind -ne "process") {
        return $true
    }

    $process = Get-Process -Id $Entry.pid -ErrorAction SilentlyContinue

    # A PID is reused after the process ends; the start time tells our process from a stranger.
    return $null -ne $process -and $process.StartTime.Ticks -eq $Entry.startedTicks
}

function Read-SharedText([string] $Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return ""
    }

    # The running app keeps the log open for writing.
    $stream = [System.IO.File]::Open($Path, "Open", "Read", "ReadWrite")

    try {
        return [System.IO.StreamReader]::new($stream).ReadToEnd()
    }
    finally {
        $stream.Dispose()
    }
}

function Test-UrlResponds([string] $Url) {
    try {
        Invoke-WebRequest -Uri $Url -SkipCertificateCheck -SkipHttpErrorCheck -TimeoutSec 5 | Out-Null

        return $true
    }
    catch {
        return $false
    }
}

function Test-EntryReady([hashtable] $Entry) {
    if ($Entry.readyLog) {
        return (Read-SharedText $Entry.log).Contains($Entry.readyLog)
    }

    $urlReady = -not $Entry.url -or (Test-UrlResponds $Entry.url)
    $processReady = -not $Entry.readyProcess -or $null -ne (Get-Process -Name $Entry.readyProcess -ErrorAction SilentlyContinue)

    return $urlReady -and $processReady
}

function Format-ReadyCondition([hashtable] $Entry) {
    if ($Entry.readyLog) {
        return "log shows '$($Entry.readyLog)'"
    }

    $conditions = @($(if ($Entry.url) { "$($Entry.url) answers" }), $(if ($Entry.readyProcess) { "process $($Entry.readyProcess) runs" }))

    return ($conditions | Where-Object { $_ }) -join " and "
}

function Wait-EntryReady([hashtable] $Entry, [datetime] $Deadline) {
    do {
        Start-Sleep -Seconds $PollSeconds
        $ready = Test-EntryReady $Entry
    } while (-not $ready -and (Test-EntryAlive $Entry) -and (Get-Date) -lt $Deadline)

    Write-Host "$($Entry.name): $(if ($ready) { 'ready' } else { 'NOT ready' }) ($(Format-ReadyCondition $Entry))"

    return $ready
}

function Write-FailureLog([hashtable] $Entry) {
    if ($Entry.kind -ne "process") {
        return
    }

    $alive = if (Test-EntryAlive $Entry) { "still running" } else { "exited" }
    Write-Host "--- $($Entry.name) ($alive), last lines of $($Entry.log) and $($Entry.errorLog):"

    @($Entry.log, $Entry.errorLog) | ForEach-Object { (Read-SharedText $_) -split "`r?`n" | Select-Object -Last $FailureLogLines } |
        ForEach-Object { Write-Host "  $_" }
}

function Stop-Entry([hashtable] $Entry) {
    if ($Entry.kind -eq "compose") {
        Stop-LocalRabbitMq

        return
    }

    if (-not (Test-EntryAlive $Entry)) {
        return
    }

    # dotnet run starts the app (or an Aspire AppHost and its children) as child processes; kill the whole tree.
    taskkill /PID $Entry.pid /T /F 2>&1 | Out-Null
    Write-Host "Stopped $($Entry.name)"
}

function Stop-Stack([hashtable] $State) {
    $State.services | ForEach-Object { Stop-Entry $_ }
    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
}
