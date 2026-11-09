using SensorMind.Api.Models;
using SensorMind.Api.Repositories;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using SensorMind.Api.Auth;
using SensorMind.Api.Logging;

namespace SensorMind.Api.Controllers;

public sealed record LoginRequest(string? Username, string? Password);

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IUserRepository users, IConfiguration config) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public IActionResult Login(LoginRequest request)
    {
        // Request log gets the attempted username (never the password), as the caller is not signed in.
        HttpContext.Items[RequestLogMiddleware.UserKey] = request.Username ?? string.Empty;
        var user = request.Username is null ? null : users.Find(request.Username);
        if (user is null || request.Password is null ||
            new PasswordHasher<User>().VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
        {
            HttpContext.Items[RequestLogMiddleware.ErrorKey] = "Wrong username or password";
            return Unauthorized();
        }

        return Ok(new { token = AuthSetup.IssueToken(user, config), username = user.Username, role = user.Role });
    }

    [HttpGet("me")]
    public IActionResult Me() =>
        Ok(new { username = User.Identity?.Name, role = User.FindFirstValue(ClaimTypes.Role) });
}
