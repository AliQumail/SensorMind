using Npgsql;

namespace SensorMind.Infrastructure.Auth;

public sealed record User(string Username, string PasswordHash, string Role);

/// <summary>PostgreSQL persistence for login users.</summary>
public sealed class UserRepository
{
    private readonly string _connectionString;

    public UserRepository(string connectionString)
    {
        _connectionString = connectionString;
        using var connection = Open();
        using var command = new NpgsqlCommand(
            "CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL)",
            connection);
        command.ExecuteNonQuery();
    }

    public User? Find(string username)
    {
        using var connection = Open();
        using var command = new NpgsqlCommand("SELECT username, password_hash, role FROM users WHERE username = @username", connection);
        command.Parameters.AddWithValue("username", username);
        using var reader = command.ExecuteReader();
        return reader.Read() ? new User(reader.GetString(0), reader.GetString(1), reader.GetString(2)) : null;
    }

    /// <summary>Adds the user unless one with the same username already exists.</summary>
    public void AddIfMissing(User user)
    {
        using var connection = Open();
        using var command = new NpgsqlCommand(
            "INSERT INTO users (username, password_hash, role) VALUES (@username, @hash, @role) ON CONFLICT (username) DO NOTHING",
            connection);
        command.Parameters.AddWithValue("username", user.Username);
        command.Parameters.AddWithValue("hash", user.PasswordHash);
        command.Parameters.AddWithValue("role", user.Role);
        command.ExecuteNonQuery();
    }

    private NpgsqlConnection Open()
    {
        var connection = new NpgsqlConnection(_connectionString);
        connection.Open();
        return connection;
    }
}
