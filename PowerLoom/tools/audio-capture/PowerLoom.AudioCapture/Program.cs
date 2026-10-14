using System.Text;
using PowerLoom.AudioCapture;

// Transcripts are Cyrillic: the console must not fall back to the ANSI code page.
Console.OutputEncoding = Encoding.UTF8;

return await CommandLine.RunAsync(args);
