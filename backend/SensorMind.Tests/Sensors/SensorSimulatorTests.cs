using SensorMind.Core.Plant;
using SensorMind.Core.Sensors;
using SensorMind.Core.Sensors.Simulation;

namespace SensorMind.Tests.Sensors;

public class SensorSimulatorTests
{
    private static readonly DateTimeOffset Start = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);

    private static readonly Tag Pressure = new("p-1.pressure", "Pressure", "bar", 3.6, 4.4, 2.8, 5.2);
    private static readonly Tag Temperature = new("p-1.temp", "Temperature", "°C", 40, 60, null, 80);

    [Fact]
    public void Same_seed_produces_identical_series()
    {
        var a = Run(new SensorSimulator([Pressure, Temperature], seed: 42), hours: 2);
        var b = Run(new SensorSimulator([Pressure, Temperature], seed: 42), hours: 2);

        Assert.Equal(a, b);
    }

    [Fact]
    public void Different_seeds_produce_different_series()
    {
        var a = Run(new SensorSimulator([Pressure], seed: 1), hours: 1);
        var b = Run(new SensorSimulator([Pressure], seed: 2), hours: 1);

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void Tag_series_is_independent_of_other_tags()
    {
        var alone = Run(new SensorSimulator([Pressure], seed: 7), hours: 1);
        var withOther = Run(new SensorSimulator([Temperature, Pressure], seed: 7), hours: 1)
            .Where(r => r.TagId == Pressure.Id);

        Assert.Equal(alone, withOther);
    }

    [Fact]
    public void Calm_profile_stays_mostly_inside_nominal_band()
    {
        var readings = Run(new SensorSimulator([Pressure], seed: 3, SimulationProfile.Calm), hours: 24);

        var normalShare = readings.Count(r => r.Status == TagStatus.Normal) / (double)readings.Count;
        Assert.True(normalShare > 0.97, $"Only {normalShare:P1} of readings were normal.");
        Assert.DoesNotContain(readings, r => r.Status == TagStatus.Alarm);
    }

    [Fact]
    public void Calm_profile_wanders_rather_than_staying_flat()
    {
        var values = Run(new SensorSimulator([Pressure], seed: 3, SimulationProfile.Calm), hours: 1)
            .Select(r => r.Value).ToList();

        var mean = values.Average();
        Assert.InRange(mean, 3.8, 4.2);
        Assert.True(values.Max() - values.Min() > 0.2, "Series is suspiciously flat.");
    }

    [Fact]
    public void Successive_samples_are_smooth()
    {
        var values = Run(new SensorSimulator([Pressure], seed: 5, SimulationProfile.Calm), hours: 1)
            .Select(r => r.Value).ToList();

        var maxJump = values.Zip(values.Skip(1), (a, b) => Math.Abs(b - a)).Max();
        var band = Pressure.NominalMax - Pressure.NominalMin;
        Assert.True(maxJump < band * 0.3, $"Max step {maxJump} is too large for a smooth walk.");
    }

    [Fact]
    public void Alarm_events_push_value_beyond_alarm_limit()
    {
        var profile = SimulationProfile.Calm with { AlarmEventsPerHour = 2 };

        var readings = Run(new SensorSimulator([Pressure], seed: 11, profile), hours: 12);

        Assert.Contains(readings, r => r.Status == TagStatus.Alarm);
    }

    [Fact]
    public void Default_profile_produces_occasional_warnings_but_is_mostly_normal()
    {
        var readings = Run(new SensorSimulator([Pressure, Temperature], seed: 99), hours: 24);

        var normalShare = readings.Count(r => r.Status == TagStatus.Normal) / (double)readings.Count;
        Assert.InRange(normalShare, 0.75, 0.995);
        Assert.Contains(readings, r => r.Status == TagStatus.Warning);
    }

    [Fact]
    public void Status_matches_tag_thresholds()
    {
        var readings = Run(new SensorSimulator([Pressure], seed: 13), hours: 6);

        Assert.All(readings, r => Assert.Equal(Pressure.Evaluate(r.Value), r.Status));
    }

    [Fact]
    public void Readings_carry_the_step_timestamp()
    {
        var simulator = new SensorSimulator([Pressure, Temperature], seed: 1);

        var batch = simulator.Step(Start);

        Assert.Equal(Start, batch.Timestamp);
        Assert.All(batch.Readings, r => Assert.Equal(Start, r.Timestamp));
        Assert.Equal([Pressure.Id, Temperature.Id], batch.Readings.Select(r => r.TagId));
    }

    private static List<SensorReading> Run(SensorSimulator simulator, int hours)
    {
        var steps = (int)(TimeSpan.FromHours(hours) / Interval);
        var readings = new List<SensorReading>();
        for (var i = 0; i < steps; i++)
        {
            readings.AddRange(simulator.Step(Start + (Interval * i)).Readings);
        }

        return readings;
    }
}
