namespace SensorMind.Core.Sensors;

public interface IReadingFeed
{
    IAsyncEnumerable<ReadingBatch> SubscribeAsync(CancellationToken cancellationToken);
}
