using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SensorMind.Core.Logs;

namespace SensorMind.Api.Controllers;

public sealed record LogsResponse(IReadOnlyList<LogEntry> Items, int Total, int Page, int PageSize);

[ApiController]
[Route("api/logs")]
[AllowAnonymous]
[Tags("Logs")]
public sealed class LogsController(ILogRepository logs) : ControllerBase
{
    private const int DefaultPageSize = 50;
    private const int MaxPageSize = 200;

    [HttpGet]
    [EndpointSummary("Public, read-only. Request log rows, newest first, filtered and paged. from/to are UTC with a Z, e.g. 2026-11-08T10:00:00Z.")]
    public IActionResult List(
        string? type, int? statusCode, string? statusClass, string? method, string? path, string? user, string? message,
        DateTimeOffset? from, DateTimeOffset? to, int page = 1, int pageSize = DefaultPageSize)
    {
        string? normalizedType = null;
        if (!string.IsNullOrWhiteSpace(type))
        {
            normalizedType = type.Trim().ToUpperInvariant();
            if (normalizedType is not ("SUCCESS" or "FAILURE"))
            {
                return BadRequest(new { message = "type must be SUCCESS or FAILURE." });
            }
        }

        int? hundreds = null;
        if (!string.IsNullOrWhiteSpace(statusClass))
        {
            var text = statusClass.Trim().ToLowerInvariant();
            if (text.Length != 3 || text[0] is < '2' or > '5' || text[1] != 'x' || text[2] != 'x')
            {
                return BadRequest(new { message = "statusClass must be 2xx, 3xx, 4xx or 5xx." });
            }

            hundreds = text[0] - '0';
        }

        var filter = new LogFilter(
            normalizedType,
            statusCode,
            hundreds,
            Blank(method)?.ToUpperInvariant(),
            Blank(path),
            Blank(user),
            Blank(message),
            from?.UtcDateTime,
            to?.UtcDateTime);

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        var result = logs.Query(filter, page, pageSize);
        return Ok(new LogsResponse(result.Items, result.Total, page, pageSize));
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
