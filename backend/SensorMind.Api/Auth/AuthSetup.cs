using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using SensorMind.Core.Auth;

namespace SensorMind.Api.Auth;

internal static class AuthSetup
{
    public const string AdminPolicy = "admin";

    // The guest account is created on first run.
    public static void SeedUsers(IUserRepository users) =>
        users.AddIfMissing(new User("guest", new PasswordHasher<User>().HashPassword(null!, "guest"), "guest"));

    public static SymmetricSecurityKey SigningKey(IConfiguration config) =>
        new(Encoding.UTF8.GetBytes(config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is not configured.")));

    public static string IssueToken(User user, IConfiguration config)
    {
        var claims = new[] { new Claim(ClaimTypes.Name, user.Username), new Claim(ClaimTypes.Role, user.Role) };
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: new SigningCredentials(SigningKey(config), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
