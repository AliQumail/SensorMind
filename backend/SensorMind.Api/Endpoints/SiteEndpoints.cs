using SensorMind.Api.Auth;
using SensorMind.Infrastructure.Sites;

namespace SensorMind.Api.Endpoints;

internal static class SiteEndpoints
{
    private const int MaxConfigBytes = 1024 * 1024;

    public static RouteGroupBuilder MapSiteEndpoints(this RouteGroupBuilder api)
    {
        var tenants = api.MapGroup("/tenants").WithTags("Tenants");

        tenants.MapGet("/", (PlantCatalog catalog) => TypedResults.Ok(catalog.Tenants));

        // One document holds the tenant and all its sites: { "tenant": "...", "sites": [ ... ] }.
        tenants.MapGet("/{id}/config", (string id, PlantCatalog catalog) =>
            catalog.GetTenantConfig(id) is { } config ? Results.Content(config, "application/json") : Results.NotFound())
            .RequireAuthorization(AuthEndpoints.AdminPolicy);

        tenants.MapPost("/", async (HttpRequest request, PlantCatalog catalog) =>
            ToResult(catalog.SaveTenant(null, await ReadBodyAsync(request))))
            .RequireAuthorization(AuthEndpoints.AdminPolicy)
            .WithSummary("Create a tenant from a plant JSON body (admin role only).");

        // Replaces the tenant: sites missing from the document are deleted.
        tenants.MapPut("/{id}", async (string id, HttpRequest request, PlantCatalog catalog) =>
            catalog.Tenants.All(t => t.Id != id)
                ? Results.NotFound()
                : ToResult(catalog.SaveTenant(id, await ReadBodyAsync(request))))
            .RequireAuthorization(AuthEndpoints.AdminPolicy)
            .WithSummary("Replace a tenant from a plant JSON body (admin role only).");

        // tenantId: the tenant being edited, whose own site and tag ids are not conflicts.
        tenants.MapPost("/validate", async (string? tenantId, HttpRequest request, PlantCatalog catalog) =>
            TypedResults.Ok(new { errors = catalog.ValidateTenant(tenantId, await ReadBodyAsync(request)) }))
            .RequireAuthorization(AuthEndpoints.AdminPolicy)
            .WithSummary("Validate a tenant's plant JSON without saving (admin role only).");

        tenants.MapDelete("/{id}", (string id, PlantCatalog catalog) =>
        {
            catalog.DeleteTenant(id);
            return TypedResults.NoContent();
        }).RequireAuthorization(AuthEndpoints.AdminPolicy)
            .WithSummary("Delete a tenant (admin role only).");

        var sites = api.MapGroup("/sites").WithTags("Sites");

        sites.MapGet("/", (PlantCatalog catalog) =>
            TypedResults.Ok(catalog.Sites.Select(s => new SiteSummary(s.Id, s.TenantId, s.Name))));

        // The validated model the dashboard renders.
        sites.MapGet("/{id}/plant", (string id, PlantCatalog catalog) =>
            catalog.TryGetPlant(id, out var plant) ? Results.Ok(plant.Plant) : Results.NotFound());

        return api;
    }

    private static IResult ToResult(SaveResult result) =>
        result.IsValid
            ? TypedResults.Ok(new { siteId = result.SiteId })
            : TypedResults.UnprocessableEntity(new { errors = result.Errors });

    private static async Task<string> ReadBodyAsync(HttpRequest request)
    {
        using var reader = new StreamReader(request.Body);
        var text = await reader.ReadToEndAsync();
        return text.Length > MaxConfigBytes ? string.Empty : text;
    }
}

internal sealed record SiteSummary(string Id, string TenantId, string Name);
