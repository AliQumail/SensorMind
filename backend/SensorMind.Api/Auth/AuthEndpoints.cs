using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using SensorMind.Api.Logging;
using SensorMind.Core.Auth;

namespace SensorMind.Api.Auth;

internal sealed record LoginRequest(string? Username, string? Password);

internal static class AuthEndpoints
{
    public const string AdminPolicy = "admin";

    // The guest account is created on first run.
    public static void SeedUsers(IUserRepository users) =>
        users.AddIfMissing(new User("guest", new PasswordHasher<User>().HashPassword(null!, "guest"), "guest"));

    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/auth").WithTags("Auth");

        group.MapPost("/login", (LoginRequest request, HttpContext context, IUserRepository users, IConfiguration config) =>
        {
            // For the request log: the attempted username (never the password), since the caller is not signed in yet.
            context.Items[RequestLogMiddleware.UserKey] = request.Username ?? string.Empty;
            var user = request.Username is null ? null : users.Find(request.Username);
            if (user is null || request.Password is null ||
                new PasswordHasher<User>().VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
            {
                context.Items[RequestLogMiddleware.ErrorKey] = "Wrong username or password";
                return Results.Unauthorized();
            }

            return TypedResults.Ok(new { token = IssueToken(user, config), username = user.Username, role = user.Role });
        }).AllowAnonymous();

        group.MapGet("/me", (ClaimsPrincipal principal) =>
            new { username = principal.Identity?.Name, role = principal.FindFirstValue(ClaimTypes.Role) });

        return api;
    }

    public static SymmetricSecurityKey SigningKey(IConfiguration config) =>
        new(Encoding.UTF8.GetBytes(config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is not configured.")));

    private static string IssueToken(User user, IConfiguration config)
    {
        var claims = new[] { new Claim(ClaimTypes.Name, user.Username), new Claim(ClaimTypes.Role, user.Role) };
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: new SigningCredentials(SigningKey(config), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
