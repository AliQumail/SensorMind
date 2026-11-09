
namespace SensorMind.Api.Models;

public sealed record User(string Username, string PasswordHash, string Role);
