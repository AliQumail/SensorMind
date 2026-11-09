using SensorMind.Api.Models;
using SensorMind.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace SensorMind.Api.Repositories;

internal sealed class LogRepository(IDbContextFactory<SensorMindDbContext> factory) : ILogRepository
{
    public void Add(LogEntry entry)
    {
        using var db = factory.CreateDbContext();
        db.Logs.Add(entry);
        db.SaveChanges();
    }

    public LogPage Query(LogFilter filter, int page, int pageSize)
    {
        using var db = factory.CreateDbContext();
        var query = db.Logs.AsNoTracking();

        if (filter.Type is { } type) query = query.Where(l => l.Type == type);
        if (filter.StatusCode is { } code) query = query.Where(l => l.StatusCode == code);
        if (filter.StatusClass is { } hundreds) query = query.Where(l => l.StatusCode >= hundreds * 100 && l.StatusCode < hundreds * 100 + 100);
        if (filter.Method is { } method) query = query.Where(l => l.Method == method);
        if (filter.Path is { } path) query = query.Where(l => EF.Functions.ILike(l.Path, Contains(path), Escape));
        if (filter.User is { } user) query = query.Where(l => EF.Functions.ILike(l.LoggedInUser, Contains(user), Escape));
        if (filter.Message is { } message) query = query.Where(l => l.ErrorMessage != null && EF.Functions.ILike(l.ErrorMessage, Contains(message), Escape));
        if (filter.FromUtc is { } from) query = query.Where(l => l.TimestampUtc >= from);
        if (filter.ToUtc is { } to) query = query.Where(l => l.TimestampUtc <= to);

        var total = query.Count();
        var items = query
            .OrderByDescending(l => l.TimestampUtc).ThenByDescending(l => l.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToList();
        return new LogPage(items, total);
    }

    private const string Escape = "\\";

    // ILIKE pattern matching anywhere, with LIKE wildcards taken literally.
    private static string Contains(string text) => "%" + text.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
}
