using SensorMind.Api.Models;
using SensorMind.Api.Services;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SensorMind.Api.Repositories;

public sealed record SaveResult(IReadOnlyList<ConfigError> Errors, string? SiteId = null)
{
    public bool IsValid => Errors.Count == 0;
}

// Saves a tenant as one document { "tenant": ..., "sites": [...] }; raises Changed after writes.
public sealed class PlantCatalog
{
    private const int MaxTenantNameLength = 100;

    private static readonly JsonDocumentOptions TenantJsonOptions = new()
    {
        AllowTrailingCommas = true,
        CommentHandling = JsonCommentHandling.Skip,
    };

    private readonly ITenantRepository _repository;
    private readonly object _writeLock = new();
    private Dictionary<string, PlantIndex> _plants = new();

    public PlantCatalog(ITenantRepository repository)
    {
        _repository = repository;
        Reload();
    }

    public event Action? Changed;

    public IReadOnlyCollection<PlantIndex> Plants => [.. _plants.Values];

    public IReadOnlyList<Tenant> Tenants => _repository.GetTenants();

    public IReadOnlyList<SiteEntry> Sites => _repository.GetSites();

    public bool TryGetPlant(string siteId, out PlantIndex plant) => _plants.TryGetValue(siteId, out plant!);

    public bool TryGetTag(string tagId, out TagLocation location)
    {
        foreach (var plant in _plants.Values)
        {
            if (plant.TryGetTag(tagId, out location!))
            {
                return true;
            }
        }

        location = null!;
        return false;
    }

    // Null if there is no such tenant.
    public string? GetTenantConfig(string id)
    {
        var tenant = _repository.GetTenants().FirstOrDefault(t => t.Id == id);
        if (tenant is null)
        {
            return null;
        }

        var sites = new JsonArray();
        foreach (var site in _repository.GetSites().Where(s => s.TenantId == id))
        {
            sites.Add(JsonNode.Parse(site.ConfigJson, documentOptions: TenantJsonOptions)!["site"]!.DeepClone());
        }

        return new JsonObject { ["tenant"] = tenant.Name, ["sites"] = sites }.ToJsonString();
    }

    // Validates without saving.
    public IReadOnlyList<ConfigError> ValidateTenant(string? tenantId, string json)
    {
        var errors = ParseTenant(json, out _, out var plants);
        errors.AddRange(FindConflicts(tenantId, plants));
        return errors;
    }

    // tenantId null creates; otherwise replaces the tenant and all its sites.
    public SaveResult SaveTenant(string? tenantId, string json)
    {
        var errors = ParseTenant(json, out var name, out var plants);
        if (errors.Count > 0)
        {
            return new SaveResult(errors);
        }

        lock (_writeLock)
        {
            var conflicts = FindConflicts(tenantId, plants);
            if (conflicts.Count > 0)
            {
                return new SaveResult(conflicts);
            }

            var tenant = new Tenant(tenantId ?? $"tenant-{Guid.NewGuid():N}"[..15], name);
            _repository.SaveTenant(tenant, [.. plants.Select(p => new SiteEntry(p.Plant.Site.Id, tenant.Id, p.Plant.Site.Name, p.Json))]);
            Reload();
        }

        Changed?.Invoke();
        return new SaveResult([], plants.FirstOrDefault()?.Plant.Site.Id);
    }

    public void DeleteTenant(string id)
    {
        lock (_writeLock)
        {
            _repository.DeleteTenant(id);
            Reload();
        }

        Changed?.Invoke();
    }

    // Only when the database is empty.
    public void SeedIfEmpty(string tenantName, string plantJson)
    {
        if (_repository.GetTenants().Count > 0)
        {
            return;
        }

        using var plant = JsonDocument.Parse(plantJson, TenantJsonOptions);
        var document = new JsonObject
        {
            ["tenant"] = tenantName,
            ["sites"] = new JsonArray(JsonNode.Parse(plant.RootElement.GetProperty("site").GetRawText(), documentOptions: TenantJsonOptions)),
        };

        var result = SaveTenant(null, document.ToJsonString());
        if (!result.IsValid)
        {
            throw new InvalidOperationException($"Seed plant is invalid:{Environment.NewLine}  {string.Join($"{Environment.NewLine}  ", result.Errors)}");
        }
    }

    private static List<ConfigError> ParseTenant(string json, out string name, out List<ParsedSite> plants)
    {
        name = string.Empty;
        plants = [];
        var errors = new List<ConfigError>();

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(json, TenantJsonOptions);
        }
        catch (JsonException ex)
        {
            errors.Add(new ConfigError("$", $"Invalid JSON: {ex.Message}"));
            return errors;
        }

        using (document)
        {
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                errors.Add(new ConfigError("$", "Must be an object with 'tenant' and 'sites'."));
                return errors;
            }

            foreach (var property in document.RootElement.EnumerateObject().Where(p => p.Name is not ("tenant" or "sites")))
            {
                errors.Add(new ConfigError($"$.{property.Name}", "Unknown property."));
            }

            if (document.RootElement.TryGetProperty("tenant", out var tenant) && tenant.ValueKind == JsonValueKind.String)
            {
                name = tenant.GetString()!.Trim();
            }

            if (name.Length is 0 or > MaxTenantNameLength)
            {
                errors.Add(new ConfigError("$.tenant", $"Required, at most {MaxTenantNameLength} characters."));
            }

            if (!document.RootElement.TryGetProperty("sites", out var sites))
            {
                return errors;
            }

            if (sites.ValueKind != JsonValueKind.Array)
            {
                errors.Add(new ConfigError("$.sites", "Must be an array."));
                return errors;
            }

            var index = 0;
            foreach (var site in sites.EnumerateArray())
            {
                var path = $"$.sites[{index++}]";
                var siteJson = $$"""{"schemaVersion":{{PlantConfigParser.CurrentSchemaVersion}},"site":{{site.GetRawText()}}}""";
                var parsed = PlantConfigParser.Parse(siteJson);
                if (parsed.Plant is { } plant)
                {
                    plants.Add(new ParsedSite(path, plant, siteJson));
                }

                errors.AddRange(parsed.Errors.Select(e => e with { Path = e.Path.StartsWith("$.site", StringComparison.Ordinal) ? path + e.Path["$.site".Length..] : path }));
            }
        }

        return errors;
    }

    // Id clashes with other tenants or within the document; tag ids are unique across sites (store key).
    private List<ConfigError> FindConflicts(string? tenantId, List<ParsedSite> plants)
    {
        var own = _repository.GetSites().Where(s => s.TenantId == tenantId).Select(s => s.Id).ToHashSet();
        var others = _plants.Where(p => !own.Contains(p.Key)).ToList();

        var errors = new List<ConfigError>();
        var siteIds = others.Select(p => p.Key).ToHashSet();
        var tagIds = others.SelectMany(p => p.Value.Tags).Select(t => t.Id).ToHashSet();

        foreach (var (path, plant, _) in plants)
        {
            if (!siteIds.Add(plant.Site.Id))
            {
                errors.Add(new ConfigError($"{path}.id", $"Site id '{plant.Site.Id}' already exists."));
            }

            errors.AddRange(plant.Site.Floors
                .SelectMany(f => f.Assets).SelectMany(e => e.Tags)
                .Where(t => !tagIds.Add(t.Id))
                .Select(t => new ConfigError(path, $"Tag id '{t.Id}' is already used by another site.")));
        }

        return errors;
    }

    private void Reload()
    {
        var plants = new Dictionary<string, PlantIndex>();
        foreach (var site in _repository.GetSites())
        {
            var result = PlantConfigParser.Parse(site.ConfigJson);
            if (result.Plant is null)
            {
                // Rows saved before the Floor > Asset model land here after an upgrade.
                throw new InvalidOperationException(
                    $"Stored site '{site.Id}' does not match the current plant format: {string.Join("; ", result.Errors.Take(3))}. " +
                    "If it was saved with groups and equipment, run the one-off conversion in docs/plant-config.md.");
            }

            plants[site.Id] = new PlantIndex(result.Plant);
        }

        _plants = plants;
    }

    private sealed record ParsedSite(string Path, PlantModel Plant, string Json);
}
