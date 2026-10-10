using PowerLoom;
using PowerLoom.AdoIntegration;

var builder = WebApplication.CreateBuilder(args);

// The executable is Wolverine's application assembly: `codegen write` puts the generated handlers here.
builder.AddPowerLoom(typeof(Program).Assembly).AddAdoIntegration();

var app = builder.Build();

app.MapPowerLoom();

return await app.RunPowerLoomAsync(args);
