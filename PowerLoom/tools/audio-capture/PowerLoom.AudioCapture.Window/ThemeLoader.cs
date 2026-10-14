using System.Windows;
using Microsoft.Win32;

namespace PowerLoom.AudioCapture.Ui;

// Picks Dark or Light: the settings' theme, or with "system" Windows' "Choose your app mode".
public static class ThemeLoader
{
    private const string PersonalizeKey = @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";

    public static void Apply(Application application, string theme)
    {
        var dictionaries = application.Resources.MergedDictionaries;

        dictionaries.Clear();
        dictionaries.Add(Dictionary(IsDark(theme) ? "Dark" : "Light"));
        dictionaries.Add(Dictionary("Controls"));
    }

    private static bool IsDark(string theme) => theme.ToLowerInvariant() switch
    {
        "dark" => true,
        "light" => false,
        _ => WindowsAppsAreDark(),
    };

    private static bool WindowsAppsAreDark()
    {
        using var key = Registry.CurrentUser.OpenSubKey(PersonalizeKey);

        return key?.GetValue("AppsUseLightTheme") is int light && light == 0;
    }

    private static ResourceDictionary Dictionary(string name) =>
        new() { Source = new Uri($"Themes/{name}.xaml", UriKind.Relative) };
}
