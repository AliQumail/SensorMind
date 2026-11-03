namespace SensorMind.Core.Plant;

/// <summary>A tag together with the equipment and floor it belongs to.</summary>
public sealed record TagLocation(Tag Tag, Equipment Equipment, Floor Floor);

/// <summary>Read-only lookups over a validated plant. Ids are unique per kind, which the parser guarantees.</summary>
public sealed class PlantIndex
{
    private readonly Dictionary<string, Equipment> _equipment = new(StringComparer.Ordinal);
    private readonly Dictionary<string, TagLocation> _tags = new(StringComparer.Ordinal);

    public PlantIndex(PlantModel plant)
    {
        ArgumentNullException.ThrowIfNull(plant);
        Plant = plant;

        foreach (var floor in plant.Site.Floors)
        {
            foreach (var equipment in floor.Groups.SelectMany(g => g.Equipment))
            {
                _equipment.Add(equipment.Id, equipment);
                foreach (var tag in equipment.Tags)
                {
                    _tags.Add(tag.Id, new TagLocation(tag, equipment, floor));
                }
            }
        }

        // Stable order (as declared in the file) so simulation and snapshots are deterministic.
        Tags = [.. _tags.Values.Select(t => t.Tag)];
    }

    public PlantModel Plant { get; }

    public IReadOnlyList<Tag> Tags { get; }

    public IReadOnlyCollection<Equipment> Equipment => _equipment.Values;

    public bool TryGetEquipment(string id, [System.Diagnostics.CodeAnalysis.NotNullWhen(true)] out Equipment? equipment) =>
        _equipment.TryGetValue(id, out equipment);

    public bool TryGetTag(string id, [System.Diagnostics.CodeAnalysis.NotNullWhen(true)] out TagLocation? location) =>
        _tags.TryGetValue(id, out location);
}
