using System.Text.Json;
using System.Text.Json.Serialization;
using DevSecrets.StackBridge;
using DevSecrets.StackBridge.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOptions<StackBridgeOptions>()
    .BindConfiguration(StackBridgeOptions.Section)
    .Validate(o => o.Token.Length >= 32, "StackBridge:Token must have at least 32 characters (start the bridge with Start-StackBridge.ps1).")
    .Validate(o => File.Exists(Path.Combine(o.ScriptsDir, "Start-LocalStack.ps1")), "StackBridge:ScriptsDir must be the DevSecrets folder.")
    .ValidateOnStart();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ScriptRunner>();
builder.Services.AddSingleton<StackOperationTracker>();
builder.Services.AddSingleton<ServiceCatalog>();
builder.Services.AddSingleton<StackService>();
builder.Services.AddHostedService<StackExpiryService>();
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

var app = builder.Build();

app.UseBridgeToken();
app.MapStackEndpoints();
app.Run();
