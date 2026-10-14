using PowerLoom.AudioCapture.Speakers;

namespace PowerLoom.AudioCapture.Commands;

// `voices` lists the stored voice profiles; `--forget <name>` drops one (a polluted profile is named again next time).
public static class VoicesCommand
{
    public static int Run(CommandOptions options)
    {
        var store = new VoiceStore(new VoiceSpace());

        if (options.Value("--forget") is { } name)
        {
            store.Remove(name);
            Console.WriteLine($"Forgot {name}");
        }

        foreach (var voice in store.Names)
        {
            Console.WriteLine(voice);
        }

        Console.WriteLine($"{store.Names.Count} named voice(s); voice space {(store.Space.IsCentered ? "centred" : "not yet centred")}");

        return 0;
    }
}
