using Microsoft.AspNetCore.WebUtilities;
using SensorMind.Core.Logs;

namespace SensorMind.Api.Logging;

/// <summary>
/// Turns unhandled exceptions into a generic 500 problem response, and writes a row to the <c>logs</c> table for
/// every 4xx/5xx response and for successful writes (login, tenant create/edit/delete, chat).
/// Nothing from the request body, query string or headers is stored.
/// </summary>
internal sealed class RequestLogMiddleware(RequestDelegate next, ILogger<RequestLogMiddleware> logger)
{
    private const int MaxErrorLength = 500;
    private const int MaxFieldLength = 200;

    /// <summary>Endpoints set these in <see cref="HttpContext.Items"/>: the username when the caller is not signed in yet, and a short failure reason.</summary>
    public const string UserKey = "log.user";

    public const string ErrorKey = "log.error";

    public async Task InvokeAsync(HttpContext context, ILogRepository logs, TimeProvider time)
    {
        string? exceptionName = null;
        try
        {
            await next(context);
        }
        catch (Exception ex) when (!context.RequestAborted.IsCancellationRequested)
        {
            logger.LogError(ex, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            exceptionName = ex.GetType().Name;
            if (!context.Response.HasStarted)
            {
                context.Response.Clear();
                await Results.Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Something went wrong on our side. Please try again.")
                    .ExecuteAsync(context);
            }
        }

        // After the response has gone out, so the insert never delays it.
        var timestamp = time.GetUtcNow().UtcDateTime;
        context.Response.OnCompleted(() =>
        {
            try
            {
                var entry = Describe(context, timestamp, exceptionName);
                if (entry is not null)
                {
                    logs.Add(entry);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: could not write the request log: {ex.GetType().Name}");
            }

            return Task.CompletedTask;
        });
    }

    private static LogEntry? Describe(HttpContext context, DateTime timestamp, string? exceptionName)
    {
        var request = context.Request;
        var status = exceptionName is null ? context.Response.StatusCode : StatusCodes.Status500InternalServerError;
        var reason = context.Items[ErrorKey] as string;
        var failed = status >= 400 || reason is not null;

        // Successful reads (sensor feed, history, health, plant, the log list) and CORS preflights are not logged; successful writes are, except validate.
        if (!failed && (HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method) || HttpMethods.IsOptions(request.Method) ||
            request.Path.Value!.EndsWith("/validate", StringComparison.OrdinalIgnoreCase)))
        {
            return null;
        }

        string? message = null;
        if (failed)
        {
            message = exceptionName is not null ? $"Unhandled {exceptionName}" : reason ?? ReasonPhrases.GetReasonPhrase(status);
            message = Truncate(message, MaxErrorLength);
        }

        var user = context.Items[UserKey] as string ?? context.User.Identity?.Name ?? string.Empty;
        return new LogEntry(
            timestamp,
            failed ? "FAILURE" : "SUCCESS",
            status,
            request.Method,
            Truncate(request.Path.Value ?? string.Empty, MaxFieldLength),
            Truncate(user, MaxFieldLength),
            message);
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}

internal static class RequestLogExtensions
{
    public static IApplicationBuilder UseRequestLog(this IApplicationBuilder app) => app.UseMiddleware<RequestLogMiddleware>();
}
