using SensorMind.Api.Models;

namespace SensorMind.Api.Services.Simulation;

// Deterministic per seed; each tag has its own RNG so adding or removing a tag leaves others unchanged.
public sealed class SensorSimulator
{
    // Longer gaps (e.g. a suspended process) are not simulated as one huge step.
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

    // FNV-1a: string.GetHashCode is randomised per process, which would break determinism.
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
