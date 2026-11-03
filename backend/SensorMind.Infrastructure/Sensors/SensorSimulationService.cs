using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SensorMind.Core.Plant;
using SensorMind.Core.Sensors;
using SensorMind.Core.Sensors.Simulation;

namespace SensorMind.Infrastructure.Sensors;

/// <summary>Drives the simulator: backfills history at startup, then samples every interval and publishes live.</summary>
internal sealed partial class SensorSimulationService(
    PlantIndex plant,
    ISensorStore store,
    ReadingBroadcaster broadcaster,
    IOptions<SimulationOptions> options,
    TimeProvider time,
    ILogger<SensorSimulationService> logger) : BackgroundService
{
    private SensorSimulator? _simulator;

    /// <summary>
    /// Backfills before returning. Hosted services start before the web server listens, so the API
    /// never serves a half-filled history window.
    /// </summary>
    public override Task StartAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var seed = settings.Seed ?? Random.Shared.Next();
        _simulator = new SensorSimulator(plant.Tags, seed);

        var started = time.GetTimestamp();
        var samples = Backfill(_simulator, settings);
        LogStarted(logger, plant.Tags.Count, seed, samples, settings.IntervalSeconds, time.GetElapsedTime(started).TotalMilliseconds);

        return base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var simulator = _simulator ?? throw new InvalidOperationException("StartAsync must run before ExecuteAsync.");

        using var timer = new PeriodicTimer(options.Value.Interval, time);
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false))
        {
            var batch = simulator.Step(time.GetUtcNow());
            store.Append(batch);
            broadcaster.Publish(batch);
        }
    }

    private int Backfill(SensorSimulator simulator, SimulationOptions settings)
    {
        var now = time.GetUtcNow();
        var interval = settings.Interval;
        var steps = (int)(TimeSpan.FromHours(settings.BackfillHours) / interval);

        for (var i = steps; i > 0; i--)
        {
            store.Append(simulator.Step(now - (interval * i)));
        }

        return steps;
    }

    [LoggerMessage(Level = LogLevel.Information,
        Message = "Sensor simulation started for {TagCount} tags (seed {Seed}), backfilled {Samples} samples per tag at {IntervalSeconds}s in {ElapsedMs:F0} ms")]
    private static partial void LogStarted(ILogger logger, int tagCount, int seed, int samples, double intervalSeconds, double elapsedMs);
}
