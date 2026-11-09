using SensorMind.Api.Models;
using SensorMind.Api.Repositories;
using Microsoft.Extensions.Options;

namespace SensorMind.Api.Services.Simulation;

// One simulator per site: backfills new tags, samples each interval, follows catalog changes.
internal sealed partial class SensorSimulationService(
    PlantCatalog catalog,
    ISensorStore store,
    ReadingBroadcaster broadcaster,
    IOptions<SimulationOptions> options,
    TimeProvider time,
    ILogger<SensorSimulationService> logger) : BackgroundService
{
    private readonly object _gate = new();
    private readonly Dictionary<string, (IReadOnlyList<Tag> Tags, SensorSimulator Simulator)> _sites = [];
    private int _seed;

    // Backfills before returning: hosted services start before the server listens, so no half-filled history.
    public override Task StartAsync(CancellationToken cancellationToken)
    {
        _seed = options.Value.Seed ?? Random.Shared.Next();
        Sync();
        catalog.Changed += Sync;
        return base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.Interval, time);
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false))
        {
            lock (_gate)
            {
                var now = time.GetUtcNow();
                foreach (var (_, simulator) in _sites.Values)
                {
                    var batch = simulator.Step(now);
                    store.Append(batch);
                    broadcaster.Publish(batch);
                }
            }
        }
    }

    public override void Dispose()
    {
        catalog.Changed -= Sync;
        base.Dispose();
    }

    private void Sync()
    {
        lock (_gate)
        {
            var plants = catalog.Plants.ToDictionary(p => p.Plant.Site.Id);

            foreach (var id in _sites.Keys.Where(id => !plants.ContainsKey(id)).ToList())
            {
                _sites.Remove(id);
            }

            foreach (var (id, plant) in plants)
            {
                if (_sites.TryGetValue(id, out var current) && current.Tags.SequenceEqual(plant.Tags))
                {
                    continue;
                }

                var simulator = new SensorSimulator(plant.Tags, _seed);
                _sites[id] = (plant.Tags, simulator);
                var samples = Backfill(simulator, plant.Tags);
                LogSynced(logger, id, plant.Tags.Count, samples);
            }
        }
    }

    // Only never-seen tags, so edits don't duplicate history.
    private int Backfill(SensorSimulator simulator, IReadOnlyList<Tag> tags)
    {
        var settings = options.Value;
        var fresh = tags.Where(t => !store.TryGetLatest(t.Id, out _)).Select(t => t.Id).ToHashSet();
        var now = time.GetUtcNow();
        var interval = settings.Interval;
        var steps = (int)(TimeSpan.FromHours(settings.BackfillHours) / interval);

        for (var i = steps; i > 0; i--)
        {
            var batch = simulator.Step(now - (interval * i));
            if (fresh.Count > 0)
            {
                store.Append(new ReadingBatch(batch.Timestamp, [.. batch.Readings.Where(r => fresh.Contains(r.TagId))]));
            }
        }

        return fresh.Count > 0 ? steps : 0;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Simulating site {SiteId}: {TagCount} tags, backfilled {Samples} samples per new tag")]
    private static partial void LogSynced(ILogger logger, string siteId, int tagCount, int samples);
}
