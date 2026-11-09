using SensorMind.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace SensorMind.Api.Controllers;

[ApiController]
[Route("api/sites")]
public sealed class SitesController(PlantCatalog catalog) : ControllerBase
{
    [HttpGet]
    public IActionResult List() =>
        Ok(catalog.Sites.Select(s => new SiteSummary(s.Id, s.TenantId, s.Name)));

    // The validated model the dashboard renders.
    [HttpGet("{id}/plant")]
    public IActionResult GetPlant(string id) =>
        catalog.TryGetPlant(id, out var plant) ? Ok(plant.Plant) : NotFound();
}

public sealed record SiteSummary(string Id, string TenantId, string Name);
