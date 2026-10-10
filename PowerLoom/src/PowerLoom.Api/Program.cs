using PowerLoom;

var builder = WebApplication.CreateBuilder(args);

// The executable is Wolverine's application assembly: `codegen write` puts the generated handlers here.
builder.AddPowerLoom(typeof(Program).Assembly);

var app = builder.Build();

app.MapPowerLoom();

return await app.RunPowerLoomAsync(args);
