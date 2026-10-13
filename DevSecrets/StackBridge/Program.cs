using System.Text.Json;
using System.Text.Json.Serialization;
using DevSecrets.StackBridge;
using DevSecrets.StackBridge.Config;
using DevSecrets.StackBridge.Models;

// The UI's files are copied next to the binary; dotnet run's working directory is wherever the script was started.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath = AppContext.BaseDirectory });

builder.Services.AddOptions<StackBridgeOptions>()
    .BindConfiguration(StackBridgeOptions.Section)
    .Validate(o => o.Token.Length >= 32, "StackBridge:Token must have at least 32 characters (start the bridge with Start-StackBridge.ps1).")
    .Validate(o => File.Exists(Path.Combine(o.ScriptsDir, "Start-LocalStack.ps1")), "StackBridge:ScriptsDir must be the DevSecrets folder.")
    .Validate(o => File.Exists(Path.Combine(o.ValuesDir, "values.remote.json")), "StackBridge:ValuesDir must hold values.remote.json.")
    .ValidateOnStart();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ScriptRunner>();
builder.Services.AddSingleton<StackOperationTracker>();
builder.Services.AddSingleton<ServiceCatalog>();
builder.Services.AddSingleton<StackService>();
builder.Services.AddSingleton<DevSecretsFiles>();
builder.Services.AddSingleton<ConfigCatalog>();
builder.Services.AddSingleton<ConfigProblems>();
builder.Services.AddHostedService<StackExpiryService>();
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

var app = builder.Build();

// The UI's static files carry no data: they load without the token and ask for it.
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseBridgeToken();
app.MapGet("/", () => Results.Redirect("/ui/"));
app.MapStackEndpoints();
app.MapConfigEndpoints();
app.Run();
