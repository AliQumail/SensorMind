using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SensorMind.Core.Sensors;
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

        return services;
    }
}
