namespace SensorMind.Core.Plant;

// Validated, immutable plant model. Hierarchy: Site -> Floor -> Group -> Equipment -> Tag.
// Instances are only produced by PlantConfigParser, so consumers can rely on the invariants
// it enforces (unique ids, nominalMin < nominalMax, footprint inside the floor, ...).

public sealed record PlantModel(int SchemaVersion, Site Site);

public sealed record Site(string Id, string Name, string? Location, IReadOnlyList<Floor> Floors);

/// <param name="Size">Floor footprint in metres. Equipment positions use the floor's corner as origin.</param>
public sealed record Floor(string Id, string Name, int Level, FloorSize Size, IReadOnlyList<EquipmentGroup> Groups);

public sealed record FloorSize(double Width, double Depth);

public sealed record EquipmentGroup(string Id, string Name, IReadOnlyList<Equipment> Equipment);

public sealed record Equipment(
    string Id,
    string Name,
    EquipmentType Type,
    string Manufacturer,
    string Model,
    string? Description,
    Placement Placement,
    IReadOnlyList<Tag> Tags);

/// <param name="Position">Centre of the footprint (x, z) in metres from the floor origin; y is the base elevation.</param>
/// <param name="Size">Bounding box dimensions in metres.</param>
/// <param name="RotationDeg">Rotation around the vertical axis, in degrees.</param>
public sealed record Placement(Vector3 Position, Vector3 Size, double RotationDeg, EquipmentShape Shape);

public readonly record struct Vector3(double X, double Y, double Z);

/// <summary>A sensor tag. Values inside the nominal band are normal, outside it a warning, and beyond an alarm limit an alarm.</summary>
public sealed record Tag(
    string Id,
    string Name,
    string Unit,
    double NominalMin,
    double NominalMax,
    double? AlarmLow,
    double? AlarmHigh);

public enum EquipmentType
{
    Pump,
    Compressor,
    Motor,
    Tank,
    Fan,
    Valve,
    HeatExchanger,
    Other,
}

public enum EquipmentShape
{
    Box,
    Cylinder,
    HorizontalCylinder,
    Sphere,
}
