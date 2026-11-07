using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using SensorMind.Api.Chat;
using SensorMind.Api.Logging;
using SensorMind.Core.Plant;
using SensorMind.Core.Sensors;
using SensorMind.Infrastructure.Manuals;
using SensorMind.Infrastructure.Sites;

namespace SensorMind.Api.Controllers;

public sealed record ChatTurn(string? Role, string? Content);

public sealed record ChatRequest(string? Question, string? AssetId, List<ChatTurn>? History);

public sealed record ChatCitation(string Source, int Page);

public sealed record ChatChart(string TagId, string Name, string Unit, double NominalMin, double NominalMax, long From, long To, IReadOnlyList<PointDto> Points);

[ApiController]
[Route("api/chat")]
public sealed partial class ChatController(
    PlantCatalog catalog,
    ISensorStore store,
    OpenRouterClient openRouter,
    ManualVectorStore vectors,
    ChatRateLimiter limiter,
    TimeProvider time,
    ILogger<ChatController> logger) : ControllerBase
{
    public const string KeyHeader = "X-OpenRouter-Key";

    private const int TopK = 5;
    private const int MaxQuestionLength = 1000;
    private const int MaxHistoryTurns = 6;
    private const int MaxHistoryLength = 2000;
    private const int MaxCharts = 2;
    private const int ChartPoints = 120;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [GeneratedRegex(@"\[(\d+)\]")]
    private static partial Regex CitationPattern();

    [GeneratedRegex(@"```chart\s*(\{.*?\})\s*```", RegexOptions.Singleline)]
    private static partial Regex ChartPattern();

    [HttpGet("status")]
    public IActionResult Status() =>
        Ok(new { configured = openRouter.HasConfiguredKey, limit = limiter.Limit, remaining = limiter.Remaining(Client()) });

    private string Client() => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    [HttpPost]
    [EndpointSummary("Ask a question; the answer streams as SSE events (Swagger UI shows it only after it finishes).")]
    public async Task<IActionResult> Ask(ChatRequest request)
    {
        var question = request.Question?.Trim();
        if (string.IsNullOrEmpty(question) || question.Length > MaxQuestionLength)
        {
            return BadRequest(new { message = $"Ask a question of up to {MaxQuestionLength} characters." });
        }

        // The user's own key is used for this request only. It is never logged or stored.
        var userKey = Request.Headers[KeyHeader].ToString();
        var ownKey = !string.IsNullOrWhiteSpace(userKey);
        if (!ownKey && !openRouter.HasConfiguredKey)
        {
            return StatusCode(
                (int)HttpStatusCode.ServiceUnavailable,
                new { message = "Chat isn't configured yet. Ask your administrator to set an OpenRouter key, or use your own key." });
        }

        var ip = Client();
        if (!ownKey && !limiter.TryTake(ip))
        {
            return StatusCode(
                (int)HttpStatusCode.TooManyRequests,
                new { message = $"You have used your {limiter.Limit} free questions for today. Add your own OpenRouter key for unlimited use, or come back tomorrow." });
        }

        var apiKey = ownKey ? userKey : null;
        var cancellationToken = HttpContext.RequestAborted;
        var response = Response;
        response.Headers.ContentType = "text/event-stream";
        response.Headers.CacheControl = "no-cache";
        response.Headers["X-Accel-Buffering"] = "no";
        HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        try
        {
            var plants = catalog.Plants;
            Asset? selected = null;
            foreach (var plant in plants)
            {
                if (request.AssetId is not null && plant.TryGetAsset(request.AssetId, out selected))
                {
                    break;
                }
            }

            var matches = await Retrieve(question, selected, apiKey, openRouter, vectors, logger, cancellationToken);
            var system = ChatPrompt.Build(plants, store, time.GetUtcNow(), question, selected, matches);

            var messages = new List<ChatMessage> { new("system", system) };
            messages.AddRange((request.History ?? [])
                .Where(t => t.Role is "user" or "assistant" && !string.IsNullOrWhiteSpace(t.Content))
                .TakeLast(MaxHistoryTurns)
                .Select(t => new ChatMessage(t.Role!, t.Content!.Length > MaxHistoryLength ? t.Content[..MaxHistoryLength] : t.Content)));
            messages.Add(new ChatMessage("user", question));

            var answer = new StringBuilder();
            await foreach (var token in openRouter.StreamChatAsync(messages, apiKey, cancellationToken))
            {
                answer.Append(token);
                await WriteAsync(response, "token", new { text = token }, cancellationToken);
            }

            var text = answer.ToString();
            var citations = CitationPattern().Matches(text)
                .Select(m => int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture))
                .Where(n => n >= 1 && n <= matches.Count)
                .Distinct()
                .Select(n => new ChatCitation(matches[n - 1].Chunk.SourceFile, matches[n - 1].Chunk.Page))
                .Distinct()
                .ToList();
            if (citations.Count > 0)
            {
                await WriteAsync(response, "citations", citations, cancellationToken);
            }

            foreach (var chart in Charts(text, plants, store, time.GetUtcNow()))
            {
                await WriteAsync(response, "chart", chart, cancellationToken);
            }

            await WriteAsync(response, "done", new { remaining = ownKey ? (int?)null : limiter.Remaining(ip) }, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Client went away.
        }
        catch (Exception ex)
        {
            logger.LogWarning("Chat request failed: {Message}", ex.Message);
            HttpContext.Items[RequestLogMiddleware.ErrorKey] = FriendlyError(ex);
            await WriteAsync(response, "error", new { message = FriendlyError(ex) }, CancellationToken.None);
        }

        return new EmptyResult();
    }

    /// <summary>Manual excerpts for the question. If the manuals are unavailable the answer continues with sensor data only.</summary>
    private static async Task<IReadOnlyList<ManualMatch>> Retrieve(
        string question,
        Asset? selected,
        string? apiKey,
        OpenRouterClient openRouter,
        ManualVectorStore vectors,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            var vector = (await openRouter.EmbedAsync([question], apiKey, cancellationToken))[0];
            var matches = await vectors.SearchAsync(vector, TopK, selected?.Manufacturer, ct: cancellationToken);
            // Manuals whose file name does not name the manufacturer carry no filter data, so widen the search.
            return matches.Count == 0 && selected is not null ? await vectors.SearchAsync(vector, TopK, ct: cancellationToken) : matches;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning("Manual search unavailable, answering from sensor data only: {Message}", ex.Message);
            return [];
        }
    }

    private static IEnumerable<ChatChart> Charts(string answer, IReadOnlyCollection<PlantIndex> plants, ISensorStore store, DateTimeOffset now)
    {
        foreach (Match match in ChartPattern().Matches(answer).Take(MaxCharts))
        {
            ChartSpec? spec;
            try
            {
                spec = JsonSerializer.Deserialize<ChartSpec>(match.Groups[1].Value, Json);
            }
            catch (JsonException)
            {
                continue;
            }

            TagLocation? location = null;
            if (spec?.TagId is null || !plants.Any(p => p.TryGetTag(spec.TagId, out location)) || location is null)
            {
                continue;
            }

            var from = now - TimeSpan.FromMinutes(Math.Clamp(spec.Minutes ?? 60, 5, 240));
            var points = TimeSeriesDownsampler.Average(store.GetHistory(spec.TagId, from, now), ChartPoints);
            yield return new ChatChart(
                spec.TagId,
                $"{location.Asset.Name}: {location.Tag.Name}",
                location.Tag.Unit,
                location.Tag.NominalMin,
                location.Tag.NominalMax,
                from.ToUnixTimeMilliseconds(),
                now.ToUnixTimeMilliseconds(),
                [.. points.Select(p => new PointDto(p.Timestamp.ToUnixTimeMilliseconds(), Math.Round(p.Value, 3)))]);
        }
    }

    private static string FriendlyError(Exception ex) => ex is HttpRequestException { StatusCode: { } status }
        ? status switch
        {
            HttpStatusCode.Unauthorized => "OpenRouter rejected the API key.",
            HttpStatusCode.PaymentRequired => "The OpenRouter account has no credit left.",
            HttpStatusCode.TooManyRequests => "OpenRouter is rate limiting requests. Try again in a moment.",
            _ => $"The model request failed ({(int)status}).",
        }
        : "The model request failed. Try again in a moment.";

    private static async Task WriteAsync(HttpResponse response, string name, object data, CancellationToken cancellationToken)
    {
        await response.WriteAsync($"event: {name}\ndata: {JsonSerializer.Serialize(data, Json)}\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    private sealed record ChartSpec(string? TagId, int? Minutes);
}
