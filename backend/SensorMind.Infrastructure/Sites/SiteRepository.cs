using Microsoft.Data.Sqlite;

namespace SensorMind.Infrastructure.Sites;

public sealed record Tenant(string Id, string Name);

public sealed record SiteEntry(string Id, string TenantId, string Name, string ConfigJson);

/// <summary>SQLite persistence for tenants and the plant config JSON of each site.</summary>
public sealed class SiteRepository
{
    private readonly string _connectionString;

    public SiteRepository(string databasePath)
    {
        var directory = Path.GetDirectoryName(Path.GetFullPath(databasePath));
        if (directory is not null)
        {
            Directory.CreateDirectory(directory);
        }

        _connectionString = $"Data Source={databasePath}";
        Execute("""
            CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sites (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                config_json TEXT NOT NULL);
            """);
    }

    public IReadOnlyList<Tenant> GetTenants() =>
        Query("SELECT id, name FROM tenants ORDER BY name", r => new Tenant(r.GetString(0), r.GetString(1)));

    public IReadOnlyList<SiteEntry> GetSites() =>
        Query("SELECT id, tenant_id, name, config_json FROM sites ORDER BY name",
            r => new SiteEntry(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3)));

    /// <summary>Creates or replaces a tenant and all its sites in one transaction, so a failure leaves nothing half saved.</summary>
    public void SaveTenant(Tenant tenant, IReadOnlyList<SiteEntry> sites)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();

        void Run(string sql, params (string Name, object Value)[] parameters)
        {
            using var command = Build(connection, sql, parameters);
            command.ExecuteNonQuery();
        }

        Run("INSERT INTO tenants (id, name) VALUES ($id, $name) ON CONFLICT(id) DO UPDATE SET name = $name",
            ("$id", tenant.Id), ("$name", tenant.Name));
        Run("DELETE FROM sites WHERE tenant_id = $id", ("$id", tenant.Id));
        foreach (var site in sites)
        {
            Run("INSERT INTO sites (id, tenant_id, name, config_json) VALUES ($id, $tenant, $name, $json)",
                ("$id", site.Id), ("$tenant", site.TenantId), ("$name", site.Name), ("$json", site.ConfigJson));
        }

        transaction.Commit();
    }

    public void DeleteTenant(string id) =>
        Execute("DELETE FROM tenants WHERE id = $id", ("$id", id));

    private SqliteConnection Open()
    {
        var connection = new SqliteConnection(_connectionString);
        connection.Open();
        using var pragma = connection.CreateCommand();
        pragma.CommandText = "PRAGMA foreign_keys = ON";
        pragma.ExecuteNonQuery();
        return connection;
    }

    private void Execute(string sql, params (string Name, object Value)[] parameters)
    {
        using var connection = Open();
        using var command = Build(connection, sql, parameters);
        command.ExecuteNonQuery();
    }

    private List<T> Query<T>(string sql, Func<SqliteDataReader, T> map)
    {
        using var connection = Open();
        using var command = Build(connection, sql, []);
        using var reader = command.ExecuteReader();
        var rows = new List<T>();
        while (reader.Read())
        {
            rows.Add(map(reader));
        }

        return rows;
    }

    private static SqliteCommand Build(SqliteConnection connection, string sql, (string Name, object Value)[] parameters)
    {
        var command = connection.CreateCommand();
        command.CommandText = sql;
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value);
        }

        return command;
    }
}
