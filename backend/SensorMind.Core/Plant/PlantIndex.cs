namespace SensorMind.Core.Plant;

/// <summary>A tag together with the asset and floor it belongs to.</summary>
public sealed record TagLocation(Tag Tag, Asset Asset, Floor Floor);

/// <summary>Read-only lookups over a validated plant. Ids are unique per kind, which the parser guarantees.</summary>
public sealed class PlantIndex
{
    private readonly Dictionary<string, Asset> _assets = new(StringComparer.Ordinal);
    private readonly Dictionary<string, TagLocation> _tags = new(StringComparer.Ordinal);

    public PlantIndex(PlantModel plant)
    {
        ArgumentNullException.ThrowIfNull(plant);
        Plant = plant;

        foreach (var floor in plant.Site.Floors)
        {
            foreach (var asset in floor.Assets)
            {
                _assets.Add(asset.Id, asset);
                foreach (var tag in asset.Tags)
                {
                    _tags.Add(tag.Id, new TagLocation(tag, asset, floor));
                }
            }
        }

        // Stable order (as declared in the file) so simulation and snapshots are deterministic.
        Tags = [.. _tags.Values.Select(t => t.Tag)];
    }

    public PlantModel Plant { get; }

    public IReadOnlyList<Tag> Tags { get; }

    public IReadOnlyCollection<Asset> Assets => _assets.Values;

    public bool TryGetAsset(string id, [System.Diagnostics.CodeAnalysis.NotNullWhen(true)] out Asset? asset) =>
        _assets.TryGetValue(id, out asset);

    public bool TryGetTag(string id, [System.Diagnostics.CodeAnalysis.NotNullWhen(true)] out TagLocation? location) =>
        _tags.TryGetValue(id, out location);
}
