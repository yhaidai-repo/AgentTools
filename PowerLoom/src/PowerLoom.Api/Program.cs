using PowerLoom;
using PowerLoom.AdoIntegration;
using PowerLoom.AzureIntegration;
using PowerLoom.ConfluenceIntegration;
using PowerLoom.LocalStackIntegration;
using PowerLoom.SqlIntegration;

var builder = WebApplication.CreateBuilder(args);

// The executable is Wolverine's application assembly: `codegen write` puts the generated handlers here.
builder.AddPowerLoom(typeof(Program).Assembly).AddAdoIntegration().AddConfluenceIntegration().AddSqlIntegration().AddAzureIntegration().AddLocalStackIntegration();

var app = builder.Build();

app.MapPowerLoom();

return await app.RunPowerLoomAsync(args);
