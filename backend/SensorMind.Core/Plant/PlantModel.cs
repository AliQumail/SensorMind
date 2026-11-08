namespace SensorMind.Core.Plant;

// Validated, immutable; only PlantConfigParser produces it, so its invariants can be relied on.

public sealed record PlantModel(int SchemaVersion, Site Site);

public sealed record Site(string Id, string Name, string? Location, IReadOnlyList<Floor> Floors);

// Size: floor footprint in metres; asset positions use the floor's corner as origin.
public sealed record Floor(string Id, string Name, int Level, FloorSize Size, IReadOnlyList<Asset> Assets);

public sealed record FloorSize(double Width, double Depth);

public sealed record Asset(
    string Id,
    string Name,
    AssetType Type,
    string Manufacturer,
    string Model,
    string? Description,
    Placement Placement,
    IReadOnlyList<Tag> Tags);

// Position: footprint centre (x, z) in metres from the floor origin, y is the base elevation. Size in metres.
public sealed record Placement(Vector3 Position, Vector3 Size, double RotationDeg, AssetShape Shape);

public readonly record struct Vector3(double X, double Y, double Z);

// Nominal band is normal, outside it warning, beyond an alarm limit alarm.
public sealed record Tag(
    string Id,
    string Name,
    string Unit,
    double NominalMin,
    double NominalMax,
    double? AlarmLow,
    double? AlarmHigh);

public enum AssetType
{
    Refrigerator,
    Pump,
    Compressor,
    Motor,
    Tank,
    Fan,
    Valve,
    HeatExchanger,
    Other,
}

public enum AssetShape
{
    Box,
    Cylinder,
    HorizontalCylinder,
    Sphere,
}
