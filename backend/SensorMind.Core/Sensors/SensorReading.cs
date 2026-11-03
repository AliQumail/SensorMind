namespace SensorMind.Core.Sensors;

public readonly record struct SensorReading(string TagId, DateTimeOffset Timestamp, double Value, TagStatus Status);

/// <summary>All readings produced in one sampling tick.</summary>
public sealed record ReadingBatch(DateTimeOffset Timestamp, IReadOnlyList<SensorReading> Readings);

public readonly record struct DataPoint(DateTimeOffset Timestamp, double Value);
