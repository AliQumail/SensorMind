using System.ComponentModel.DataAnnotations;

namespace SensorMind.Infrastructure.Sensors;

public sealed class SimulationOptions
{
    public const string SectionName = "Simulation";

    // Random per process start when omitted.
    public int? Seed { get; set; }

    [Range(0.5, 60)]
    public double IntervalSeconds { get; set; } = 2;

    [Range(0.1, 72)]
    public double RetentionHours { get; set; } = 24;

    // Generated instantly at startup so charts and trend questions work immediately.
    [Range(0, 72)]
    public double BackfillHours { get; set; } = 24;

    public TimeSpan Interval => TimeSpan.FromSeconds(IntervalSeconds);

    public int CapacityPerTag => (int)Math.Ceiling(RetentionHours * 3600 / IntervalSeconds) + 1;
}
