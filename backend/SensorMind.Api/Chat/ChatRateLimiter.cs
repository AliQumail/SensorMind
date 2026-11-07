namespace SensorMind.Api.Chat;

/// <summary>Free questions per client address per UTC day, counted in memory (resets on restart).</summary>
public sealed class ChatRateLimiter(TimeProvider time, IConfiguration configuration)
{
    private readonly object _lock = new();
    private readonly Dictionary<string, int> _used = [];
    private DateOnly _day;

    public int Limit => configuration.GetValue("Chat:FreeQueriesPerDay", 10);

    public bool TryTake(string client)
    {
        lock (_lock)
        {
            Roll();
            var used = _used.GetValueOrDefault(client);
            if (used >= Limit)
            {
                return false;
            }

            _used[client] = used + 1;
            return true;
        }
    }

    public int Remaining(string client)
    {
        lock (_lock)
        {
            Roll();
            return Math.Max(0, Limit - _used.GetValueOrDefault(client));
        }
    }

    private void Roll()
    {
        var today = DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime);
        if (today != _day)
        {
            _day = today;
            _used.Clear();
        }
    }
}
