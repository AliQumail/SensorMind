using System.Text.Json;
using System.Text.Json.Serialization;
using SensorMind.Api.Endpoints;
using SensorMind.Infrastructure;
using SensorMind.Infrastructure.Plant;

var builder = WebApplication.CreateBuilder(args);

// Fail fast on a bad plant file: the exception lists every validation error.
var plantPath = Path.Combine(builder.Environment.ContentRootPath, builder.Configuration["Plant:ConfigPath"] ?? "data/plant.sample.json");
var plant = PlantConfigLoader.LoadFromFile(plantPath);

builder.Services.AddSensorMindInfrastructure(builder.Configuration, plant);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower));
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().WithMethods("GET", "POST")));

builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();

app.MapHealthChecks("/health");

var api = app.MapGroup("/api");
api.MapPlantEndpoints();
api.MapSensorEndpoints();

app.Run();

// Exposed for WebApplicationFactory-based integration tests.
public partial class Program;
