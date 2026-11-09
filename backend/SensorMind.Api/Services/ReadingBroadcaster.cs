using SensorMind.Api.Models;
using SensorMind.Api.Repositories;
using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;

namespace SensorMind.Api.Services;

// Per-subscriber bounded channel dropping the oldest batch, so a slow client never stalls others.
public sealed class ReadingBroadcaster : IReadingFeed
{
    private const int SubscriberBufferSize = 16;

    private readonly ConcurrentDictionary<Guid, Channel<ReadingBatch>> _subscribers = new();

    public int SubscriberCount => _subscribers.Count;

    public void Publish(ReadingBatch batch)
    {
        foreach (var channel in _subscribers.Values)
        {
            channel.Writer.TryWrite(batch);
        }
    }

    public async IAsyncEnumerable<ReadingBatch> SubscribeAsync([EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var channel = Channel.CreateBounded<ReadingBatch>(new BoundedChannelOptions(SubscriberBufferSize)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

        var id = Guid.NewGuid();
        _subscribers[id] = channel;
        try
        {
            await foreach (var batch in channel.Reader.ReadAllAsync(cancellationToken).ConfigureAwait(false))
            {
                yield return batch;
            }
        }
        finally
        {
            _subscribers.TryRemove(id, out _);
        }
    }
}
