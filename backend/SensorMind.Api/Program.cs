using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SensorMind.Api.Auth;
using SensorMind.Api.Chat;
using SensorMind.Api.Logging;
using SensorMind.Infrastructure;
using SensorMind.Core.Auth;
using SensorMind.Infrastructure.Sites;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("SensorMind")
    ?? throw new InvalidOperationException("ConnectionStrings:SensorMind is not configured.");
builder.Services.AddSensorMindInfrastructure(builder.Configuration, connectionString);

// The same JSON rules for controller responses and for the SSE streams, which serialize by hand.
static void ConfigureJson(JsonSerializerOptions options)
{
    options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower));
    options.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
}

builder.Services.ConfigureHttpJsonOptions(options => ConfigureJson(options.SerializerOptions));
builder.Services.AddControllers(options =>
    {
        // Request bodies are JSON or raw text; reading them as a form would consume the body (and reject long ones).
        foreach (var form in options.ValueProviderFactories.Where(f => f is FormValueProviderFactory or FormFileValueProviderFactory or JQueryFormValueProviderFactory).ToList())
        {
            options.ValueProviderFactories.Remove(form);
        }
    })
    .AddJsonOptions(options => ConfigureJson(options.JsonSerializerOptions));

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().WithMethods("GET", "POST", "PUT", "DELETE")));

var signingKey = AuthSetup.SigningKey(builder.Configuration);
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
    .AddPolicy(AuthSetup.AdminPolicy, policy => policy.RequireRole("admin"));

builder.Services.AddSingleton<ChatRateLimiter>();
// MVC adds a traceId to every problem response; the contract has never had one.
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context => context.ProblemDetails.Extensions.Remove("traceId"));
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

// First run: the sample plant becomes the first tenant with one site.
app.Services.GetRequiredService<PlantCatalog>().SeedIfEmpty(
    "Walnut",
    File.ReadAllText(Path.Combine(builder.Environment.ContentRootPath, builder.Configuration["Plant:ConfigPath"] ?? "data/plant.sample.json")));
AuthSetup.SeedUsers(app.Services.GetRequiredService<IUserRepository>());

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

app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory-based integration tests.
public partial class Program;
