using System.Collections.Concurrent;
using SensorMind.Core.Sensors;

namespace SensorMind.Infrastructure.Sensors;

/// <summary>
/// Rolling window of readings per tag, kept in fixed-size ring buffers. Memory is bounded by
/// <c>capacityPerTag * tags * 16 bytes</c> (about 1.5 MB per tag for 24h at 2s).
/// Assumes timestamps are appended in non-decreasing order per tag, which the simulator guarantees.
/// </summary>
public sealed class InMemorySensorStore : ISensorStore
{
    private readonly ConcurrentDictionary<string, Series> _series = new(StringComparer.Ordinal);
    private readonly int _capacityPerTag;

    public InMemorySensorStore(int capacityPerTag)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(capacityPerTag, 1);
        _capacityPerTag = capacityPerTag;
    }

    public void Append(ReadingBatch batch)
    {
        ArgumentNullException.ThrowIfNull(batch);
        foreach (var reading in batch.Readings)
        {
            _series.GetOrAdd(reading.TagId, static (_, capacity) => new Series(capacity), _capacityPerTag).Append(reading);
        }
    }

    public IReadOnlyList<SensorReading> GetLatest() =>
        [.. _series.Values.Select(s => s.Latest).OfType<SensorReading>()];

    public bool TryGetLatest(string tagId, out SensorReading reading)
    {
        if (_series.TryGetValue(tagId, out var series) && series.Latest is { } latest)
        {
            reading = latest;
            return true;
        }

        reading = default;
        return false;
    }

    public IReadOnlyList<DataPoint> GetHistory(string tagId, DateTimeOffset from, DateTimeOffset to) =>
        _series.TryGetValue(tagId, out var series) ? series.Range(from, to) : [];

    private readonly record struct Sample(long UtcTicks, double Value);

    private sealed class Series(int capacity)
    {
        private readonly object _lock = new();
        private readonly Sample[] _buffer = new Sample[capacity];
        private int _start;
        private int _count;
        private SensorReading? _latest;

        // Multi-word struct: read under the lock to avoid torn reads.
        public SensorReading? Latest
        {
            get
            {
                lock (_lock)
                {
                    return _latest;
                }
            }
        }

        public void Append(SensorReading reading)
        {
            lock (_lock)
            {
                var sample = new Sample(reading.Timestamp.UtcTicks, reading.Value);
                if (_count < _buffer.Length)
                {
                    _buffer[(_start + _count) % _buffer.Length] = sample;
                    _count++;
                }
                else
                {
                    // Full: overwrite the oldest sample.
                    _buffer[_start] = sample;
                    _start = (_start + 1) % _buffer.Length;
                }

                _latest = reading;
            }
        }

        public List<DataPoint> Range(DateTimeOffset from, DateTimeOffset to)
        {
            lock (_lock)
            {
                var first = LowerBound(from.UtcTicks);
                var end = LowerBound(to.UtcTicks + 1);
                var result = new List<DataPoint>(Math.Max(0, end - first));
                for (var i = first; i < end; i++)
                {
                    var sample = At(i);
                    result.Add(new DataPoint(new DateTimeOffset(sample.UtcTicks, TimeSpan.Zero), sample.Value));
                }

                return result;
            }
        }

        /// <summary>Logical index of the first sample with timestamp &gt;= <paramref name="ticks"/>.</summary>
        private int LowerBound(long ticks)
        {
            int lo = 0, hi = _count;
            while (lo < hi)
            {
                var mid = lo + ((hi - lo) / 2);
                if (At(mid).UtcTicks < ticks)
                {
                    lo = mid + 1;
                }
                else
                {
                    hi = mid;
                }
            }

            return lo;
        }

        private Sample At(int logicalIndex) => _buffer[(_start + logicalIndex) % _buffer.Length];
    }
}
