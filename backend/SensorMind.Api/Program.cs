using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SensorMind.Api.Auth;
using SensorMind.Api.Chat;
using SensorMind.Api.Endpoints;
using SensorMind.Api.Logging;
using SensorMind.Infrastructure;
using SensorMind.Core.Auth;
using SensorMind.Infrastructure.Sites;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("SensorMind")
    ?? throw new InvalidOperationException("ConnectionStrings:SensorMind is not configured.");
builder.Services.AddSensorMindInfrastructure(builder.Configuration, connectionString);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower));
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().WithMethods("GET", "POST", "PUT", "DELETE")));

var signingKey = AuthEndpoints.SigningKey(builder.Configuration);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            IssuerSigningKey = signingKey,
            ValidateIssuer = false,
            ValidateAudience = false,
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role,
        };

        // EventSource cannot send an Authorization header, so the live stream takes the token as a query parameter.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Path.StartsWithSegments("/api/readings/stream"))
                {
                    context.Token = context.Request.Query["access_token"];
                }

                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddPolicy(AuthEndpoints.AdminPolicy, policy => policy.RequireRole("admin"));

builder.Services.AddSingleton<ChatRateLimiter>();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Token from POST /api/auth/login.",
    });

    options.OperationFilter<AuthOperationFilter>();
});

var app = builder.Build();

app.Services.MigrateSensorMindDatabase();

// First run: the sample plant becomes a demo tenant with one site.
app.Services.GetRequiredService<PlantCatalog>().SeedIfEmpty(
    "Demo Tenant",
    File.ReadAllText(Path.Combine(builder.Environment.ContentRootPath, builder.Configuration["Plant:ConfigPath"] ?? "data/plant.sample.json")));
AuthEndpoints.SeedUsers(app.Services.GetRequiredService<IUserRepository>());

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRequestLog();
app.UseStatusCodePages();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health").AllowAnonymous();

var api = app.MapGroup("/api");
api.MapAuthEndpoints();
api.MapSiteEndpoints();
api.MapPlantEndpoints();
api.MapSensorEndpoints();
api.MapChatEndpoints();

app.Run();

// Exposed for WebApplicationFactory-based integration tests.
public partial class Program;
