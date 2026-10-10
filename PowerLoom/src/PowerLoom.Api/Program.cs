using PowerLoom;

var builder = WebApplication.CreateBuilder(args);

builder.AddPowerLoom();

var app = builder.Build();

app.MapPowerLoom();

return await app.RunPowerLoomAsync(args);
