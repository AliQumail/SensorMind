namespace SensorMind.Core.Sensors;

/// <summary>
/// Time-series storage for tag readings. The in-memory rolling window is the only implementation
/// today; the interface exists so a real historian or TSDB can replace it.
/// </summary>
public interface ISensorStore
{
    void Append(ReadingBatch batch);

    /// <summary>Most recent reading per tag, for tags that have at least one.</summary>
    IReadOnlyList<SensorReading> GetLatest();

    bool TryGetLatest(string tagId, out SensorReading reading);

    /// <summary>Points with <paramref name="from"/> &lt;= timestamp &lt;= <paramref name="to"/>, oldest first.</summary>
    IReadOnlyList<DataPoint> GetHistory(string tagId, DateTimeOffset from, DateTimeOffset to);
}
