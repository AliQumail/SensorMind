using SensorMind.Api.Models;

namespace SensorMind.Api.Repositories;

public interface IReadingFeed
{
    IAsyncEnumerable<ReadingBatch> SubscribeAsync(CancellationToken cancellationToken);
}
