namespace SensorMind.Core.Auth;

public sealed record User(string Username, string PasswordHash, string Role);
