using SensorMind.Core.Sensors;
using SensorMind.Infrastructure.Sensors;

namespace SensorMind.Tests.Sensors;

public class InMemorySensorStoreTests
{
    private static readonly DateTimeOffset Start = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Returns_latest_reading_per_tag()
    {
        var store = new InMemorySensorStore(capacityPerTag: 10);
        store.Append(Batch(0, ("a", 1), ("b", 10)));
        store.Append(Batch(1, ("a", 2)));

        Assert.True(store.TryGetLatest("a", out var a));
        Assert.Equal(2, a.Value);
        Assert.Equal(Start.AddSeconds(1), a.Timestamp);
        Assert.Equal(2, store.GetLatest().Count);
        Assert.False(store.TryGetLatest("missing", out _));
    }

    [Fact]
    public void History_is_inclusive_and_ordered()
    {
        var store = new InMemorySensorStore(capacityPerTag: 100);
        for (var i = 0; i < 10; i++)
        {
            store.Append(Batch(i, ("a", i)));
        }

        var history = store.GetHistory("a", Start.AddSeconds(3), Start.AddSeconds(6));

        Assert.Equal([3d, 4, 5, 6], history.Select(p => p.Value));
    }

    [Fact]
    public void Evicts_oldest_samples_when_capacity_is_reached()
    {
        var store = new InMemorySensorStore(capacityPerTag: 5);
        for (var i = 0; i < 12; i++)
        {
            store.Append(Batch(i, ("a", i)));
        }

        var history = store.GetHistory("a", Start, Start.AddHours(1));

        Assert.Equal([7d, 8, 9, 10, 11], history.Select(p => p.Value));
    }

    [Fact]
    public void Range_queries_work_across_the_ring_buffer_wrap_point()
    {
        var store = new InMemorySensorStore(capacityPerTag: 5);
        for (var i = 0; i < 8; i++)
        {
            store.Append(Batch(i, ("a", i)));
        }

        Assert.Equal([4d, 5, 6], store.GetHistory("a", Start.AddSeconds(4), Start.AddSeconds(6)).Select(p => p.Value));
    }

    [Fact]
    public void Unknown_tag_or_empty_range_returns_empty_history()
    {
        var store = new InMemorySensorStore(capacityPerTag: 5);
        store.Append(Batch(0, ("a", 1)));

        Assert.Empty(store.GetHistory("missing", Start, Start.AddHours(1)));
        Assert.Empty(store.GetHistory("a", Start.AddHours(1), Start.AddHours(2)));
    }

    private static ReadingBatch Batch(int second, params (string Tag, double Value)[] values)
    {
        var ts = Start.AddSeconds(second);
        return new ReadingBatch(ts, [.. values.Select(v => new SensorReading(v.Tag, ts, v.Value, TagStatus.Normal))]);
    }
}
