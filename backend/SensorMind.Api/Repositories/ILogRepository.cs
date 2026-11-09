using SensorMind.Api.Models;

namespace SensorMind.Api.Repositories;

// Text filters match case-insensitively anywhere in the value.
public sealed record LogFilter(
    string? Type = null,
    int? StatusCode = null,
    int? StatusClass = null,
    string? Method = null,
    string? Path = null,
    string? User = null,
    string? Message = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null);

public sealed record LogPage(IReadOnlyList<LogEntry> Items, int Total);

public interface ILogRepository
{
    void Add(LogEntry entry);

    // Newest first; page starts at 1. Also returns the total match count.
    LogPage Query(LogFilter filter, int page, int pageSize);
}
