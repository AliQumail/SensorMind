using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SensorMind.Api.Auth;
using SensorMind.Infrastructure.Sites;

namespace SensorMind.Api.Controllers;

[ApiController]
[Route("api/tenants")]
public sealed class TenantsController(PlantCatalog catalog) : ControllerBase
{
    private const int MaxConfigBytes = 1024 * 1024;

    [HttpGet]
    public IActionResult List() => Ok(catalog.Tenants);

    // One document holds the tenant and all its sites: { "tenant": "...", "sites": [ ... ] }.
    [HttpGet("{id}/config")]
    [Authorize(AuthSetup.AdminPolicy)]
    public IActionResult GetConfig(string id) =>
        catalog.GetTenantConfig(id) is { } config ? Content(config, "application/json") : NotFound();

    [HttpPost]
    [Authorize(AuthSetup.AdminPolicy)]
    [EndpointSummary("Create a tenant from a plant JSON body (admin role only).")]
    public async Task<IActionResult> Create() => ToResult(catalog.SaveTenant(null, await ReadBodyAsync()));

    // Replaces the tenant: sites missing from the document are deleted.
    [HttpPut("{id}")]
    [Authorize(AuthSetup.AdminPolicy)]
    [EndpointSummary("Replace a tenant from a plant JSON body (admin role only).")]
    public async Task<IActionResult> Replace(string id) =>
        catalog.Tenants.All(t => t.Id != id)
            ? NotFound()
            : ToResult(catalog.SaveTenant(id, await ReadBodyAsync()));

    // tenantId: the tenant being edited, whose own site and tag ids are not conflicts.
    [HttpPost("validate")]
    [Authorize(AuthSetup.AdminPolicy)]
    [EndpointSummary("Validate a tenant's plant JSON without saving (admin role only).")]
    public async Task<IActionResult> Validate(string? tenantId) =>
        Ok(new { errors = catalog.ValidateTenant(tenantId, await ReadBodyAsync()) });

    [HttpDelete("{id}")]
    [Authorize(AuthSetup.AdminPolicy)]
    [EndpointSummary("Delete a tenant (admin role only).")]
    public IActionResult Delete(string id)
    {
        catalog.DeleteTenant(id);
        return NoContent();
    }

    private IActionResult ToResult(SaveResult result) =>
        result.IsValid
            ? Ok(new { siteId = result.SiteId })
            : UnprocessableEntity(new { errors = result.Errors });

    private async Task<string> ReadBodyAsync()
    {
        using var reader = new StreamReader(Request.Body);
        var text = await reader.ReadToEndAsync();
        return text.Length > MaxConfigBytes ? string.Empty : text;
    }
}
