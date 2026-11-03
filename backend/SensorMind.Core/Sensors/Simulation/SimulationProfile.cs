namespace SensorMind.Core.Sensors.Simulation;

/// <summary>Tunable behaviour of simulated tags. Event rates are per tag.</summary>
public sealed record SimulationProfile
{
    /// <summary>Default profile: mostly calm, with drifts and spikes visible within minutes and a few alarms per hour plant-wide.</summary>
    public static SimulationProfile Default { get; } = new();

    /// <summary>Random walk only, no drift/spike/alarm events. Useful for tests and baselines.</summary>
    public static SimulationProfile Calm { get; } = new() { DriftsPerHour = 0, SpikesPerHour = 0, AlarmEventsPerHour = 0 };

    /// <summary>Time constant pulling the value back to the band centre.</summary>
    public double MeanReversionSeconds { get; init; } = 90;

    /// <summary>Stationary standard deviation of the walk as a fraction of the nominal half band.</summary>
    public double NoiseFraction { get; init; } = 0.18;

    public double DriftsPerHour { get; init; } = 0.4;

    /// <summary>Peak drift offset as a fraction of the half band. Values above 1 leave the nominal band (warning).</summary>
    public double MaxDriftFraction { get; init; } = 1.2;

    public double SpikesPerHour { get; init; } = 0.6;

    public double AlarmEventsPerHour { get; init; } = 1.0 / 12;
}
