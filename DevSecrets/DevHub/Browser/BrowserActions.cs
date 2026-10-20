using DevSecrets.DevHub.Models;
using Microsoft.Playwright;

namespace DevSecrets.DevHub.Browser;

// Performs one action on the page. The locator comes from the action's target; `typed` is what a fill types (the
// given value, or the resolved dev-secrets value).
public static class BrowserActions
{
    private const int ActionTimeoutMs = 15_000;

    public static HubResult Validate(BrowserAction action, string? typed)
    {
        if (action.Action == BrowserActionKind.Navigate)
            return string.IsNullOrWhiteSpace(action.Url) ? HubResult.Invalid("navigate needs url.") : HubResult.Ok();

        if (!HasTarget(action))
            return HubResult.Invalid($"{Verb(action)} needs a target: role + name, label, text, placeholder or selector.");

        if (action.Action is BrowserActionKind.Fill or BrowserActionKind.Select && typed is null)
            return HubResult.Invalid($"{Verb(action)} needs value or valueName.");

        if (action.Action == BrowserActionKind.Press && string.IsNullOrWhiteSpace(action.Key))
            return HubResult.Invalid("press needs key, e.g. Enter.");

        return HubResult.Ok();
    }

    public static async Task PerformAsync(IPage page, BrowserAction action, string? typed)
    {
        if (action.Action == BrowserActionKind.Navigate)
        {
            await page.GotoAsync(action.Url!, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

            return;
        }

        var target = Locate(page, action);

        await PerformOnAsync(target, action, typed);
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    private static Task PerformOnAsync(ILocator target, BrowserAction action, string? typed) => action.Action switch
    {
        BrowserActionKind.Click => target.ClickAsync(new LocatorClickOptions { Timeout = ActionTimeoutMs }),
        BrowserActionKind.Fill => target.FillAsync(typed!, new LocatorFillOptions { Timeout = ActionTimeoutMs }),
        BrowserActionKind.Press => target.PressAsync(action.Key!, new LocatorPressOptions { Timeout = ActionTimeoutMs }),
        BrowserActionKind.Select => target.SelectOptionAsync(typed!, new LocatorSelectOptionOptions { Timeout = ActionTimeoutMs }),
        BrowserActionKind.Check => target.CheckAsync(new LocatorCheckOptions { Timeout = ActionTimeoutMs }),
        BrowserActionKind.Uncheck => target.UncheckAsync(new LocatorUncheckOptions { Timeout = ActionTimeoutMs }),
        BrowserActionKind.Hover => target.HoverAsync(new LocatorHoverOptions { Timeout = ActionTimeoutMs }),
        _ => throw new InvalidOperationException($"Unknown action {action.Action}"),
    };

    private static ILocator Locate(IPage page, BrowserAction action)
    {
        var exact = action.Exact ?? false;

        if (action.Role is not null)
            return page.GetByRole(RoleOf(action.Role), new PageGetByRoleOptions { Name = action.Name, Exact = exact });

        if (action.Label is not null)
            return page.GetByLabel(action.Label, new PageGetByLabelOptions { Exact = exact });

        if (action.Placeholder is not null)
            return page.GetByPlaceholder(action.Placeholder, new PageGetByPlaceholderOptions { Exact = exact });

        if (action.Text is not null)
            return page.GetByText(action.Text, new PageGetByTextOptions { Exact = exact });

        return page.Locator(action.Selector!);
    }

    private static bool HasTarget(BrowserAction action) =>
        action.Role is not null || action.Label is not null || action.Placeholder is not null || action.Text is not null || action.Selector is not null;

    private static AriaRole RoleOf(string role) =>
        Enum.TryParse<AriaRole>(role, ignoreCase: true, out var parsed) ? parsed : throw new ArgumentException($"Unknown role {role}; use the roles the snapshot shows (button, link, textbox, …).");

    private static string Verb(BrowserAction action) => action.Action.ToString().ToLowerInvariant();
}
