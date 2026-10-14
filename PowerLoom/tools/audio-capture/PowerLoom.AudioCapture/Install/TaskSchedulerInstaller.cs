using System.Diagnostics;

namespace PowerLoom.AudioCapture.Install;

// Task Scheduler task "PowerLoom audio capture": `run` at logon, hidden (conhost --headless), as the user, no admin.
public static class TaskSchedulerInstaller
{
    public const string TaskName = "PowerLoom audio capture";

    public static void Install()
    {
        var exe = Environment.ProcessPath ?? throw new InvalidOperationException("Unknown executable path");
        // Single quotes: PowerShell takes the inner double quotes literally (conhost needs them around the exe path).
        var arguments = $"--headless \"{exe}\" run";
        var script = $"""
            $action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument '{arguments}'
            $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
            $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
            $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
            Register-ScheduledTask -TaskName '{TaskName}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
            Start-ScheduledTask -TaskName '{TaskName}'
            """;

        RunPowerShell(script);
    }

    public static void Uninstall() =>
        RunPowerShell($"Unregister-ScheduledTask -TaskName '{TaskName}' -Confirm:$false -ErrorAction SilentlyContinue");

    private static void RunPowerShell(string script)
    {
        var start = new ProcessStartInfo("powershell.exe", $"-NoProfile -NonInteractive -Command -")
        {
            RedirectStandardInput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };

        using var process = Process.Start(start) ?? throw new InvalidOperationException("powershell.exe didn't start");

        process.StandardInput.Write(script);
        process.StandardInput.Close();

        var errors = process.StandardError.ReadToEnd();

        process.WaitForExit();

        if (process.ExitCode != 0 || errors.Length > 0)
            throw new InvalidOperationException($"Task Scheduler change failed: {errors.Trim()}");
    }
}
