using SensorMind.Core.Plant;

namespace SensorMind.Core.Sensors.Simulation;

/// <summary>
/// Generates readings for a set of tags. Fully deterministic for a given seed, tag set and sequence
/// of timestamps. Each tag gets its own RNG derived from the seed and its id, so adding or removing
/// a tag does not change the values of the others.
/// </summary>
public sealed class SensorSimulator
{
    /// <summary>Gaps larger than this (e.g. a suspended process) are not simulated as one huge step.</summary>
    private static readonly TimeSpan MaxStep = TimeSpan.FromMinutes(1);

    private readonly TagSimulator[] _tags;
    private DateTimeOffset? _last;

    public SensorSimulator(IEnumerable<Tag> tags, int seed, SimulationProfile? profile = null)
    {
        ArgumentNullException.ThrowIfNull(tags);
        profile ??= SimulationProfile.Default;
        _tags = [.. tags.Select(t => new TagSimulator(t, seed ^ StableHash(t.Id), profile))];
    }

    public ReadingBatch Step(DateTimeOffset timestamp)
    {
        var dt = _last is { } last ? timestamp - last : TimeSpan.Zero;
        if (dt > MaxStep)
        {
            dt = MaxStep;
        }

        _last = timestamp;

        var readings = new SensorReading[_tags.Length];
        for (var i = 0; i < _tags.Length; i++)
        {
            var sim = _tags[i];
            var value = sim.Step(dt.TotalSeconds);
            readings[i] = new SensorReading(sim.Tag.Id, timestamp, value, sim.Tag.Evaluate(value));
        }

        return new ReadingBatch(timestamp, readings);
    }

    /// <summary>FNV-1a. string.GetHashCode is randomised per process, which would break determinism.</summary>
    private static int StableHash(string value)
    {
        unchecked
        {
            var hash = 2166136261u;
            foreach (var c in value)
            {
                hash = (hash ^ c) * 16777619u;
            }

            return (int)hash;
        }
    }
}
