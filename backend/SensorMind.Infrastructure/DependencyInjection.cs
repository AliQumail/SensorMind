using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Qdrant.Client;
using SensorMind.Core.Sensors;
using SensorMind.Infrastructure.Auth;
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
        services.AddSingleton(new SiteRepository(connectionString));
        services.AddSingleton(new UserRepository(connectionString));
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

        return services;
    }
}
