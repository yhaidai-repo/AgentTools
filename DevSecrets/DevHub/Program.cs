using System.Text.Json;
using System.Text.Json.Serialization;
using DevSecrets.DevHub;
using DevSecrets.DevHub.Browser;
using DevSecrets.DevHub.Config;
using DevSecrets.DevHub.Models;

// The UI's files are copied next to the binary; dotnet run's working directory is wherever the script was started.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath = AppContext.BaseDirectory });

builder.Services.AddOptions<DevHubOptions>()
    .BindConfiguration(DevHubOptions.Section)
    .Validate(o => o.Token.Length >= 32, "DevHub:Token must have at least 32 characters (start DevHub with Start-DevHub.ps1).")
    .Validate(o => File.Exists(Path.Combine(o.ScriptsDir, "Start-LocalStack.ps1")), "DevHub:ScriptsDir must be the DevSecrets folder.")
    .Validate(o => File.Exists(Path.Combine(o.ValuesDir, "values.dev.json")), "DevHub:ValuesDir must hold values.dev.json.")
    .Validate(o => o.BrowserArtifactsDir.Length > 0, "DevHub:BrowserArtifactsDir must be set (start DevHub with Start-DevHub.ps1).")
    .Validate(o => o.McpDir.Length > 0, "DevHub:McpDir must be set (start DevHub with Start-DevHub.ps1).")
    .ValidateOnStart();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ScriptRunner>();
builder.Services.AddSingleton<StackOperationTracker>();
builder.Services.AddSingleton<ServiceCatalog>();
builder.Services.AddSingleton<StackService>();
builder.Services.AddSingleton<DevSecretsFiles>();
builder.Services.AddSingleton<ConfigCatalog>();
builder.Services.AddSingleton<ConfigProblems>();
builder.Services.AddSingleton<ValuesFileWriter>();
builder.Services.AddSingleton<SecretEditor>();
builder.Services.AddSingleton<ScriptCheck>();
builder.Services.AddSingleton<ConfigEditor>();
builder.Services.AddHostedService<StackExpiryService>();
builder.Services.AddSingleton<SecretsFile>();
builder.Services.AddSingleton<LocalRepoBranches>();
builder.Services.AddSingleton<SecretHttpClient>();
builder.Services.AddSingleton<BrowserService>();
builder.Services.AddHostedService<BrowserExpiryService>();
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

var app = builder.Build();

// The UI's static files carry no data: they load without the token and ask for it.
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseHubToken();
app.MapGet("/", () => Results.Redirect("/ui/"));
app.MapStackEndpoints();
app.MapConfigEndpoints();
app.MapBrowserEndpoints();
app.Run();
