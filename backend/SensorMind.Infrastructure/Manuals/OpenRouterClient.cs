using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace SensorMind.Infrastructure.Manuals;

public sealed class OpenRouterOptions
{
    public const string SectionName = "OpenRouter";

    public string BaseUrl { get; set; } = "https://openrouter.ai/api/v1";

    /// <summary>Server-side key, from configuration or environment only. Callers may pass their own per request instead.</summary>
    public string? ApiKey { get; set; }

    public string EmbeddingModel { get; set; } = "openai/text-embedding-3-small";

    public string ChatModel { get; set; } = "openai/gpt-4o-mini";
}

public sealed record ChatMessage(string Role, string Content);

/// <summary>Embeddings and streaming chat completions over OpenRouter's OpenAI-compatible API.</summary>
public sealed class OpenRouterClient(HttpClient http, IOptions<OpenRouterOptions> options)
{
    private readonly OpenRouterOptions _options = options.Value;

    public bool HasConfiguredKey => !string.IsNullOrWhiteSpace(_options.ApiKey);

    public async Task<float[][]> EmbedAsync(IReadOnlyList<string> inputs, string? apiKey = null, CancellationToken ct = default)
    {
        using var request = Build("embeddings", new { model = _options.EmbeddingModel, input = inputs }, apiKey);
        using var response = await http.SendAsync(request, ct);
        await EnsureSuccessAsync(response, ct);

        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        return [.. document.RootElement.GetProperty("data").EnumerateArray()
            .OrderBy(item => item.GetProperty("index").GetInt32())
            .Select(item => item.GetProperty("embedding").EnumerateArray().Select(v => v.GetSingle()).ToArray())];
    }

    /// <summary>Yields the answer text as it arrives.</summary>
    public async IAsyncEnumerable<string> StreamChatAsync(
        IReadOnlyList<ChatMessage> messages,
        string? apiKey = null,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var body = new
        {
            model = _options.ChatModel,
            stream = true,
            messages = messages.Select(m => new { role = m.Role, content = m.Content }),
        };
        using var request = Build("chat/completions", body, apiKey);
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        await EnsureSuccessAsync(response, ct);

        using var reader = new StreamReader(await response.Content.ReadAsStreamAsync(ct));
        while (await reader.ReadLineAsync(ct) is { } line)
        {
            if (!line.StartsWith("data:", StringComparison.Ordinal))
            {
                continue;
            }

            var data = line["data:".Length..].Trim();
            if (data == "[DONE]")
            {
                yield break;
            }

            using var chunk = JsonDocument.Parse(data);
            if (chunk.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0 &&
                choices[0].TryGetProperty("delta", out var delta) &&
                delta.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.String &&
                content.GetString() is { Length: > 0 } text)
            {
                yield return text;
            }
        }
    }

    private HttpRequestMessage Build(string path, object body, string? apiKey)
    {
        var key = string.IsNullOrWhiteSpace(apiKey) ? _options.ApiKey : apiKey;
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new InvalidOperationException("No OpenRouter API key is configured.");
        }

        var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        return request;
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var detail = await response.Content.ReadAsStringAsync(ct);
        throw new HttpRequestException(
            $"OpenRouter returned {(int)response.StatusCode}: {(detail.Length > 300 ? detail[..300] : detail)}",
            null,
            response.StatusCode);
    }
}
