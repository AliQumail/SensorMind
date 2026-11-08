namespace SensorMind.Core.Sensors;

// In-memory window is the only implementation; the interface lets a historian or TSDB replace it.
public interface ISensorStore
{
    void Append(ReadingBatch batch);

    IReadOnlyList<SensorReading> GetLatest();

    bool TryGetLatest(string tagId, out SensorReading reading);

    // Inclusive range, oldest first.
    IReadOnlyList<DataPoint> GetHistory(string tagId, DateTimeOffset from, DateTimeOffset to);
}
