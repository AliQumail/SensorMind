using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SensorMind.Core.Plant;
using SensorMind.Core.Sensors;
using SensorMind.Infrastructure.Sites;

namespace SensorMind.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class ReadingsController(
    ISensorStore store,
    IReadingFeed feed,
    PlantCatalog catalog,
    TimeProvider time,
    IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions> jsonOptions) : ControllerBase
{
    private static readonly TimeSpan DefaultHistoryWindow = TimeSpan.FromHours(1);
    private const int DefaultMaxPoints = 300;
    private const int MaxPointsLimit = 2000;

    [HttpGet("readings/latest")]
    public IActionResult Latest() => Ok(store.GetLatest().Select(ReadingDto.From));

    /// <summary>
    /// Server-Sent Events: an initial "readings" event with the latest value of every tag, then one per
    /// sampling tick. SSE over WebSockets because traffic is one-way and it survives proxies and
    /// reconnects (EventSource retries automatically) with no extra client code.
    /// </summary>
    [HttpGet("readings/stream")]
    [EndpointSummary("Live readings as SSE (never ends; Swagger UI cannot show it live). Token may be sent as ?access_token=.")]
    public async Task Stream()
    {
        var cancellationToken = HttpContext.RequestAborted;
        var response = Response;
        response.Headers.ContentType = "text/event-stream";
        response.Headers.CacheControl = "no-cache";
        response.Headers["X-Accel-Buffering"] = "no"; // stop nginx-style proxies from buffering
        HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

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

    [HttpGet("tags/{tagId}/history")]
    public IActionResult GetHistory(string tagId, DateTimeOffset? from, DateTimeOffset? to, int? maxPoints)
    {
        if (!catalog.TryGetTag(tagId, out var location))
        {
            return new JsonResult($"Unknown tag '{tagId}'.") { StatusCode = StatusCodes.Status404NotFound };
        }

        var end = to ?? time.GetUtcNow();
        var start = from ?? end - DefaultHistoryWindow;
        var limit = maxPoints ?? DefaultMaxPoints;

        if (start >= end)
        {
            ModelState.AddModelError("from", "'from' must be earlier than 'to'.");
        }

        if (limit is < 2 or > MaxPointsLimit)
        {
            ModelState.AddModelError("maxPoints", $"Must be between 2 and {MaxPointsLimit}.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var points = TimeSeriesDownsampler.Average(store.GetHistory(tagId, start, end), limit);
        return Ok(new TagHistoryDto(
            tagId,
            location.Tag.Unit,
            start.ToUnixTimeMilliseconds(),
            end.ToUnixTimeMilliseconds(),
            [.. points.Select(p => new PointDto(p.Timestamp.ToUnixTimeMilliseconds(), Math.Round(p.Value, 3)))]));
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
}

// Sensor payloads use Unix epoch milliseconds: compact on the wire and native to JS Date and charts.

public sealed record ReadingDto(string TagId, long Ts, double Value, TagStatus Status)
{
    public static ReadingDto From(SensorReading r) => new(r.TagId, r.Timestamp.ToUnixTimeMilliseconds(), r.Value, r.Status);
}

public sealed record TagHistoryDto(string TagId, string Unit, long From, long To, IReadOnlyList<PointDto> Points);

public sealed record PointDto(long T, double V);
