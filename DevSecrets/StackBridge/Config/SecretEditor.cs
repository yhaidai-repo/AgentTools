using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DevSecrets.StackBridge.Models;

namespace DevSecrets.StackBridge.Config;

// The UI's changes to the named values: add or replace one, delete one nobody reads. Expected refusals are results.
public sealed partial class SecretEditor(DevSecretsFiles files, ConfigCatalog catalog, ValuesFileWriter writer)
{
    // The bridge and every vault's PowerLoom settings hold it: a change here would lock both out until they are updated.
    private const string BridgeToken = "stack-bridge-token";

    private readonly Lock _gate = new();

    public BridgeResult Save(string file, string name, string? value)
    {
        var refusal = Refusal(file, name) ?? (value is null ? BridgeResult.Invalid("Send a value (it may be empty).") : null);

        if (refusal is not null)
            return refusal;

        lock (_gate)
        {
            var values = files.ReadValues(file)!;

            values[name] = value;
            writer.Write(file, values);
        }

        return BridgeResult.Ok();
    }

    public BridgeResult Delete(string file, string name)
    {
        var refusal = Refusal(file, name) ?? ReaderRefusal(file, name);

        if (refusal is not null)
            return refusal;

        lock (_gate)
        {
            return RemoveAndWrite(file, name);
        }
    }

    private BridgeResult RemoveAndWrite(string file, string name)
    {
        var values = files.ReadValues(file)!;

        if (!values.Remove(name))
            return BridgeResult.NotFound($"No value '{name}' in values.{file}.json.");

        writer.Write(file, values);

        return BridgeResult.Ok();
    }

    private BridgeResult? Refusal(string file, string name)
    {
        if (files.ReadValues(file) is null)
            return BridgeResult.NotFound($"No values file values.{file}.json.");

        if (!ValueName().IsMatch(name))
            return BridgeResult.Invalid("A value name is lower-case letters and digits, joined by single '-' (e.g. signals-remote-url), at most 64 characters.");

        return name == BridgeToken ? BridgeResult.Conflict($"{BridgeToken} is the bridge's own token: change it in the file and restart the bridge, then update PowerLoom's Local stack settings.") : null;
    }

    // A value still read by a project or a script would leave that setting empty: remove the reader first. An override in
    // a file that extends another (values.local.json) falls back to the base value, so it may go.
    private BridgeResult? ReaderRefusal(string file, string name)
    {
        var readers = catalog.ValueUsage().GetValueOrDefault(name);

        if (readers is not { Count: > 0 } || BaseHasValue(file, name))
            return null;

        return BridgeResult.Conflict($"'{name}' is still read by: {string.Join("; ", readers)}.");
    }

    private bool BaseHasValue(string file, string name)
    {
        var extends = files.ReadValues(file)?[DevSecretsFiles.ExtendsKey]?.ToString();

        return extends is not null && files.ReadValues(extends)?.ContainsKey(name) == true;
    }

    [GeneratedRegex("^(?=.{1,64}$)[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex ValueName();
}
