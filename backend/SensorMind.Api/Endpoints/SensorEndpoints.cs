using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using SensorMind.Core.Plant;
using SensorMind.Core.Sensors;
using SensorMind.Infrastructure.Sites;

namespace SensorMind.Api.Endpoints;

internal static class SensorEndpoints
{
    private static readonly TimeSpan DefaultHistoryWindow = TimeSpan.FromHours(1);
    private const int DefaultMaxPoints = 300;
    private const int MaxPointsLimit = 2000;

    public static RouteGroupBuilder MapSensorEndpoints(this RouteGroupBuilder api)
    {
        var readings = api.MapGroup("/readings").WithTags("Readings");
        readings.MapGet("/latest", (ISensorStore store) => TypedResults.Ok(store.GetLatest().Select(ReadingDto.From)));
        readings.MapGet("/stream", StreamAsync);

        api.MapGet("/tags/{tagId}/history", GetHistory).WithTags("Readings");

        return api;
    }

    /// <summary>
    /// Server-Sent Events: an initial "readings" event with the latest value of every tag, then one per
    /// sampling tick. SSE over WebSockets because traffic is one-way and it survives proxies and
    /// reconnects (EventSource retries automatically) with no extra client code.
    /// </summary>
    private static async Task StreamAsync(
        HttpContext context,
        ISensorStore store,
        IReadingFeed feed,
        IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions> jsonOptions)
    {
        var cancellationToken = context.RequestAborted;
        var response = context.Response;
        response.Headers.ContentType = "text/event-stream";
        response.Headers.CacheControl = "no-cache";
        response.Headers["X-Accel-Buffering"] = "no"; // stop nginx-style proxies from buffering
        context.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        var json = jsonOptions.Value.SerializerOptions;
        try
        {
            await response.WriteAsync("retry: 3000\n\n", cancellationToken);
            await WriteEventAsync(response, store.GetLatest(), json, cancellationToken);

            await foreach (var batch in feed.SubscribeAsync(cancellationToken))
            {
                await WriteEventAsync(response, batch.Readings, json, cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Client disconnected; nothing to clean up.
        }
    }

    private static async Task WriteEventAsync(
        HttpResponse response,
        IReadOnlyList<SensorReading> readings,
        JsonSerializerOptions json,
        CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(readings.Select(ReadingDto.From), json);
        await response.WriteAsync($"event: readings\ndata: {payload}\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    private static Results<Ok<TagHistoryDto>, NotFound<string>, ValidationProblem> GetHistory(
        string tagId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int? maxPoints,
        PlantCatalog catalog,
        ISensorStore store,
        TimeProvider time)
    {
        if (!catalog.TryGetTag(tagId, out var location))
        {
            return TypedResults.NotFound($"Unknown tag '{tagId}'.");
        }

        var end = to ?? time.GetUtcNow();
        var start = from ?? end - DefaultHistoryWindow;
        var limit = maxPoints ?? DefaultMaxPoints;

        var errors = new Dictionary<string, string[]>();
        if (start >= end)
        {
            errors["from"] = ["'from' must be earlier than 'to'."];
        }

        if (limit is < 2 or > MaxPointsLimit)
        {
            errors["maxPoints"] = [$"Must be between 2 and {MaxPointsLimit}."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var points = TimeSeriesDownsampler.Average(store.GetHistory(tagId, start, end), limit);
        return TypedResults.Ok(new TagHistoryDto(
            tagId,
            location.Tag.Unit,
            start.ToUnixTimeMilliseconds(),
            end.ToUnixTimeMilliseconds(),
            [.. points.Select(p => new PointDto(p.Timestamp.ToUnixTimeMilliseconds(), Math.Round(p.Value, 3)))]));
    }
}

// Sensor payloads use Unix epoch milliseconds: compact on the wire and native to JS Date and charts.

internal sealed record ReadingDto(string TagId, long Ts, double Value, TagStatus Status)
{
    public static ReadingDto From(SensorReading r) => new(r.TagId, r.Timestamp.ToUnixTimeMilliseconds(), r.Value, r.Status);
}

internal sealed record TagHistoryDto(string TagId, string Unit, long From, long To, IReadOnlyList<PointDto> Points);

internal sealed record PointDto(long T, double V);
