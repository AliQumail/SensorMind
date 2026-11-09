
namespace SensorMind.Api.Services.Simulation;

// Event rates are per tag.
public sealed record SimulationProfile
{
    // Mostly calm; drifts and spikes within minutes, a few alarms per hour plant-wide.
    public static SimulationProfile Default { get; } = new();

    // Random walk only, no events; for tests and baselines.
    public static SimulationProfile Calm { get; } = new() { DriftsPerHour = 0, SpikesPerHour = 0, AlarmEventsPerHour = 0 };

    // Time constant pulling the value back to the band centre.
    public double MeanReversionSeconds { get; init; } = 90;

    // Stationary standard deviation of the walk as a fraction of the nominal half band.
    public double NoiseFraction { get; init; } = 0.18;

    public double DriftsPerHour { get; init; } = 0.4;

    // Peak drift as a fraction of the half band; above 1 leaves the nominal band (warning).
    public double MaxDriftFraction { get; init; } = 1.2;

    public double SpikesPerHour { get; init; } = 0.6;

    public double AlarmEventsPerHour { get; init; } = 1.0 / 12;
}
