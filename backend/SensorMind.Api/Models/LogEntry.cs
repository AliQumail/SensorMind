
namespace SensorMind.Api.Models;

// Type is SUCCESS or FAILURE.
public sealed record LogEntry(
    DateTime TimestampUtc,
    string Type,
    int StatusCode,
    string Method,
    string Path,
    string LoggedInUser,
    string? ErrorMessage)
{
    public long Id { get; init; }
}
