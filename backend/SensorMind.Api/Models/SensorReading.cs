
namespace SensorMind.Api.Models;

public readonly record struct SensorReading(string TagId, DateTimeOffset Timestamp, double Value, TagStatus Status);

public sealed record ReadingBatch(DateTimeOffset Timestamp, IReadOnlyList<SensorReading> Readings);

public readonly record struct DataPoint(DateTimeOffset Timestamp, double Value);
