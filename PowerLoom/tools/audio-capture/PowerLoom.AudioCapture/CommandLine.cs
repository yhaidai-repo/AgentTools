using PowerLoom.AudioCapture.Commands;

namespace PowerLoom.AudioCapture;

public static class CommandLine
{
    public static async Task<int> RunAsync(string[] args)
    {
        if (args.Length == 0)
        {
            PrintUsage();

            return 1;
        }

        var options = CommandOptions.Parse(args.Skip(1));

        try
        {
            return await DispatchAsync(args[0], options);
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException)
        {
            Console.Error.WriteLine(exception.Message);

            return 1;
        }
    }

    private static async Task<int> DispatchAsync(string command, CommandOptions options) => command switch
    {
        "run" => await RecordCommands.RunAsync(),
        "record" => await RecordCommands.RecordAsync(options),
        "status" => RecordCommands.Status(),
        "quit" => await RecordCommands.QuitAsync(),
        "install" => await InstallCommands.InstallAsync(options),
        "uninstall" => await InstallCommands.UninstallAsync(),
        "transcribe" => await TranscribeCommands.TranscribeAsync(options),
        "download-model" => await TranscribeCommands.DownloadModelAsync(options),
        "devices" => TranscribeCommands.Devices(),
        "live-replay" => await LiveReplayCommand.RunAsync(options),
        "speakers" => SpeakersCommand.Run(options),
        "record-for" => await TranscribeCommands.RecordForAsync(options),
        _ => Unknown(command),
    };

    private static int Unknown(string command)
    {
        Console.Error.WriteLine($"Unknown command: {command}");
        PrintUsage();

        return 1;
    }

    private static void PrintUsage()
    {
        Console.WriteLine("""
            PowerLoom.AudioCapture <command>
              install --inbox <path> [--home <path>] [--model <name>] [--hotkey <keys>] [--mic <name>] [--system <name>] [--languages uk,ru,en] [--theme dark|light|system]
                                                                        settings + logon task; starts the resident process
              uninstall                                                 removes the task and stops the resident process
              record start [--title <text>]                             starts a recording (title: Teams call window, else "meeting")
              record stop                                               stops it; transcription and inbox hand-over follow
              status | quit                                             the resident process
              run                                                       the resident process itself (hotkey, control files)
              transcribe <folder> [--model <name>] [--prompt-file <path>] [--with-context] [--runtime cuda|vulkan|cpu] [--inbox <path>] [--no-speakers]
              download-model <large-v3|large-v3-turbo>
              devices                                                   microphones and outputs with their default roles
              speakers <folder> [--rename "Speaker 1=Anna"]              a session's voices; naming stores the voice for later meetings
              live-replay <folder> [--model <name>] [--prompt-file <path>] [--languages uk,ru,en]   a session's WAVs through the live path (chunks at pauses), no playback
              record-for <seconds> [--title <text>] [--no-aec]          fixed-length recording without the resident process
            """);
    }
}
