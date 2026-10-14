using PowerLoom.AudioCapture.Settings;
using PowerLoom.AudioCapture.Speakers;

namespace PowerLoom.AudioCapture.Commands;

// `speakers <folder>` lists a session's voices; `--rename "Speaker 1=Anna"` names one (also from the window).
public static class SpeakersCommand
{
    public static int Run(CommandOptions options)
    {
        var folder = options.Positional(0) ?? throw new ArgumentException("speakers needs a session folder");

        if (options.Value("--rename") is { } rename)
            Rename(folder, rename);

        foreach (var speaker in SessionSpeakers.Load(folder))
        {
            Console.WriteLine($"{speaker.Label}: {speaker.Seconds:F0} s{(speaker.Known ? " (known voice)" : "")}");
        }

        return 0;
    }

    private static void Rename(string folder, string rename)
    {
        var parts = rename.Split('=', 2, StringSplitOptions.TrimEntries);

        if (parts.Length != 2)
            throw new ArgumentException("--rename takes \"<old label>=<name>\"");

        var renamed = new SpeakerRenamer(new VoiceStore(new VoiceSpace()), SettingsStore.Load()).Rename(folder, parts[0], parts[1]);

        Console.WriteLine(renamed ? $"Renamed {parts[0]} to {parts[1]}; voice stored" : $"No speaker '{parts[0]}' in {folder}");
    }
}
