using Microsoft.AspNetCore.Mvc;
using SensorMind.Core.Plant;

namespace SensorMind.Api.Controllers;

[ApiController]
[Route("api/plant")]
public sealed class PlantController : ControllerBase
{
    private const int MaxConfigBytes = 1024 * 1024;

    // Validates a plant file without applying it; import is file-based (docs/decisions.md) as the demo is public.
    [HttpPost("validate")]
    public async Task<IActionResult> Validate(CancellationToken cancellationToken)
    {
        if (Request.ContentLength > MaxConfigBytes)
        {
            return Problem($"Plant config must be at most {MaxConfigBytes / 1024} KB.", statusCode: StatusCodes.Status413PayloadTooLarge);
        }

        var result = await PlantConfigParser.ParseAsync(Request.Body, cancellationToken);
        return Ok(new PlantValidationResponse(
            result.IsValid,
            result.Errors,
            result.Plant is { } plant ? PlantSummary.From(plant) : null));
    }
}

public sealed record PlantValidationResponse(bool Valid, IReadOnlyList<ConfigError> Errors, PlantSummary? Summary);

public sealed record PlantSummary(int Floors, int Assets, int Tags)
{
    public static PlantSummary From(PlantModel plant)
    {
        var assets = plant.Site.Floors.SelectMany(f => f.Assets).ToList();
        return new PlantSummary(plant.Site.Floors.Count, assets.Count, assets.Sum(e => e.Tags.Count));
    }
}
