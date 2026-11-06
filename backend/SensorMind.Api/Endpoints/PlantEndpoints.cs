using SensorMind.Core.Plant;

namespace SensorMind.Api.Endpoints;

internal static class PlantEndpoints
{
    private const int MaxConfigBytes = 1024 * 1024;

    public static RouteGroupBuilder MapPlantEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/plant").WithTags("Plant");

        // Validates a candidate plant file without applying it. Importing is file-based (see docs/decisions.md),
        // because the demo is public and one visitor must not be able to replace the plant for everyone.
        group.MapPost("/validate", ValidateAsync);

        return api;
    }

    private static async Task<IResult> ValidateAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        if (request.ContentLength > MaxConfigBytes)
        {
            return TypedResults.Problem($"Plant config must be at most {MaxConfigBytes / 1024} KB.", statusCode: StatusCodes.Status413PayloadTooLarge);
        }

        var result = await PlantConfigParser.ParseAsync(request.Body, cancellationToken);
        return TypedResults.Ok(new PlantValidationResponse(
            result.IsValid,
            result.Errors,
            result.Plant is { } plant ? PlantSummary.From(plant) : null));
    }
}

internal sealed record PlantValidationResponse(bool Valid, IReadOnlyList<ConfigError> Errors, PlantSummary? Summary);

internal sealed record PlantSummary(int Floors, int Assets, int Tags)
{
    public static PlantSummary From(PlantModel plant)
    {
        var assets = plant.Site.Floors.SelectMany(f => f.Assets).ToList();
        return new PlantSummary(plant.Site.Floors.Count, assets.Count, assets.Sum(e => e.Tags.Count));
    }
}
