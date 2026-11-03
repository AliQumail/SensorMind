using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SensorMind.Core.Plant;
using SensorMind.Core.Sensors;
using SensorMind.Infrastructure.Sensors;

namespace SensorMind.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddSensorMindInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        PlantModel plant)
    {
        services.AddSingleton(new PlantIndex(plant));
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
