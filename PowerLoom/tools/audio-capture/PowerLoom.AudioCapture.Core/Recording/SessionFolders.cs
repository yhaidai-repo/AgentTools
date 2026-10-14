namespace PowerLoom.AudioCapture.Recording;

// Where recordings live: <home>/recordings/<yyyy-MM-dd_HHmm>-<slug>.
public static class SessionFolders
{
    public static string Root => Path.Combine(AppPaths.Home, "recordings");

    public static string NewSessionFolder(string? title)
    {
        var stamp = DateTime.Now.ToString("yyyy-MM-dd_HHmm");
        var slug = Slug(title ?? "meeting");

        return Path.Combine(Root, $"{stamp}-{slug}");
    }

    private static string Slug(string title)
    {
        var kept = title.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-');
        var slug = new string(kept.ToArray()).Trim('-');

        return slug.Length == 0 ? "meeting" : slug[..Math.Min(slug.Length, 40)];
    }
}
