using SensorMind.Core.Sensors;
using SensorMind.Infrastructure.Sensors;

namespace SensorMind.Tests.Sensors;

public class ReadingBroadcasterTests
{
    [Fact]
    public async Task Delivers_published_batches_to_every_subscriber()
    {
        var broadcaster = new ReadingBroadcaster();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        await using var first = broadcaster.SubscribeAsync(cts.Token).GetAsyncEnumerator(cts.Token);
        await using var second = broadcaster.SubscribeAsync(cts.Token).GetAsyncEnumerator(cts.Token);

        // Subscription registers on first MoveNextAsync; start both before publishing.
        var firstNext = first.MoveNextAsync();
        var secondNext = second.MoveNextAsync();
        var batch = new ReadingBatch(DateTimeOffset.UnixEpoch, []);
        broadcaster.Publish(batch);

        Assert.True(await firstNext);
        Assert.True(await secondNext);
        Assert.Same(batch, first.Current);
        Assert.Same(batch, second.Current);
    }

    [Fact]
    public async Task Removes_subscriber_when_enumeration_ends()
    {
        var broadcaster = new ReadingBroadcaster();
        using var cts = new CancellationTokenSource();

        var enumerator = broadcaster.SubscribeAsync(cts.Token).GetAsyncEnumerator(cts.Token);
        var pending = enumerator.MoveNextAsync();
        Assert.Equal(1, broadcaster.SubscriberCount);

        await cts.CancelAsync();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => await pending);
        await enumerator.DisposeAsync();

        Assert.Equal(0, broadcaster.SubscriberCount);
    }
}
