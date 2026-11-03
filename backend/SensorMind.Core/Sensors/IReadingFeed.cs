namespace SensorMind.Core.Sensors;

/// <summary>Live fan-out of reading batches to any number of subscribers (SSE clients, later the chat context).</summary>
public interface IReadingFeed
{
    IAsyncEnumerable<ReadingBatch> SubscribeAsync(CancellationToken cancellationToken);
}
