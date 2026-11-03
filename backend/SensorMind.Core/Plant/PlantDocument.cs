using System.Text.Json;
using System.Text.Json.Serialization;

namespace SensorMind.Core.Plant;

// Raw shape of the plant JSON file. Everything is nullable so that missing fields surface as
// readable validation errors (with a JSON path) instead of deserialization exceptions.
// Only PlantConfigParser should use these types.

internal abstract class DocumentBase
{
    /// <summary>Captures misspelled or unsupported properties so they can be reported instead of silently ignored.</summary>
    [JsonExtensionData]
    public Dictionary<string, JsonElement>? UnknownProperties { get; set; }
}

internal sealed class PlantDocument : DocumentBase
{
    public int? SchemaVersion { get; init; }
    public SiteDocument? Site { get; init; }
}

internal sealed class SiteDocument : DocumentBase
{
    public string? Id { get; init; }
    public string? Name { get; init; }
    public string? Location { get; init; }
    public List<FloorDocument?>? Floors { get; init; }
}

internal sealed class FloorDocument : DocumentBase
{
    public string? Id { get; init; }
    public string? Name { get; init; }
    public int? Level { get; init; }
    public FloorSizeDocument? Size { get; init; }
    public List<GroupDocument?>? Groups { get; init; }
}

internal sealed class FloorSizeDocument : DocumentBase
{
    public double? Width { get; init; }
    public double? Depth { get; init; }
}

internal sealed class GroupDocument : DocumentBase
{
    public string? Id { get; init; }
    public string? Name { get; init; }
    public List<EquipmentDocument?>? Equipment { get; init; }
}

internal sealed class EquipmentDocument : DocumentBase
{
    public string? Id { get; init; }
    public string? Name { get; init; }
    public string? Type { get; init; }
    public string? Manufacturer { get; init; }
    public string? Model { get; init; }
    public string? Description { get; init; }
    public VectorDocument? Position { get; init; }
    public VectorDocument? Size { get; init; }
    public double? Rotation { get; init; }
    public string? Shape { get; init; }
    public List<TagDocument?>? Tags { get; init; }
}

internal sealed class VectorDocument : DocumentBase
{
    public double? X { get; init; }
    public double? Y { get; init; }
    public double? Z { get; init; }
}

internal sealed class TagDocument : DocumentBase
{
    public string? Id { get; init; }
    public string? Name { get; init; }
    public string? Unit { get; init; }
    public double? NominalMin { get; init; }
    public double? NominalMax { get; init; }
    public double? AlarmLow { get; init; }
    public double? AlarmHigh { get; init; }
}
