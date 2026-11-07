using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Qdrant.Client;
using SensorMind.Core.Auth;
using SensorMind.Core.Logs;
using SensorMind.Core.Sites;
using SensorMind.Core.Sensors;
using SensorMind.Infrastructure.Auth;
using SensorMind.Infrastructure.Data;
using SensorMind.Infrastructure.Logs;
using SensorMind.Infrastructure.Manuals;
using SensorMind.Infrastructure.Sensors;
using SensorMind.Infrastructure.Sites;

namespace SensorMind.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddSensorMindInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddDbContextFactory<SensorMindDbContext>(options => options.UseNpgsql(connectionString));
        services.AddSingleton<ITenantRepository, TenantRepository>();
        services.AddSingleton<IUserRepository, UserRepository>();
        services.AddSingleton<ILogRepository, LogRepository>();
        services.AddSingleton<PlantCatalog>();
        services.AddSingleton(TimeProvider.System);

        services.AddOptions<SimulationOptions>()
            .Bind(configuration.GetSection(SimulationOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton<ISensorStore>(sp =>
            new InMemorySensorStore(sp.GetRequiredService<IOptions<SimulationOptions>>().Value.CapacityPerTag));
        services.AddSingleton<ReadingBroadcaster>();
        services.AddSingleton<IReadingFeed>(sp => sp.GetRequiredService<ReadingBroadcaster>());
        services.AddHostedService<SensorSimulationService>();

        services.AddOptions<QdrantOptions>()
            .Bind(configuration.GetSection(QdrantOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();
        services.AddSingleton(sp =>
        {
            var qdrant = sp.GetRequiredService<IOptions<QdrantOptions>>().Value;
            return new QdrantClient(new Uri(qdrant.Url), qdrant.ApiKey);
        });
        services.AddSingleton<ManualVectorStore>();

        services.Configure<OpenRouterOptions>(configuration.GetSection(OpenRouterOptions.SectionName));
        services.Configure<ManualsOptions>(configuration.GetSection(ManualsOptions.SectionName));
        services.AddHttpClient<OpenRouterClient>((sp, client) =>
        {
            client.BaseAddress = new Uri(sp.GetRequiredService<IOptions<OpenRouterOptions>>().Value.BaseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromMinutes(5);
        });
        services.AddHostedService<ManualIngestionService>();

        return services;
    }

    /// <summary>Creates or upgrades the database schema. Run once at startup, before anything reads the tables.</summary>
    public static void MigrateSensorMindDatabase(this IServiceProvider services)
    {
        using var db = services.GetRequiredService<IDbContextFactory<SensorMindDbContext>>().CreateDbContext();
        db.Database.Migrate();
    }
}
