using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SensorMind.Core.Plant;

/// <summary>A problem found in a plant config, located by a JSONPath such as <c>$.site.floors[0].groups[1]</c>.</summary>
public sealed record ConfigError(string Path, string Message)
{
    public override string ToString() => $"{Path}: {Message}";
}

public sealed class PlantConfigResult
{
    private PlantConfigResult(PlantModel? plant, IReadOnlyList<ConfigError> errors)
    {
        Plant = plant;
        Errors = errors;
    }

    /// <summary>The validated plant, or null when <see cref="Errors"/> is non-empty.</summary>
    public PlantModel? Plant { get; }

    public IReadOnlyList<ConfigError> Errors { get; }

    public bool IsValid => Plant is not null;

    internal static PlantConfigResult Success(PlantModel plant) => new(plant, []);

    internal static PlantConfigResult Failure(IReadOnlyList<ConfigError> errors) => new(null, errors);
}

/// <summary>
/// Parses and validates a plant config JSON document in a single pass. All errors are collected
/// (not just the first) so a user fixing a file sees everything that is wrong at once.
/// </summary>
public static partial class PlantConfigParser
{
    public const int CurrentSchemaVersion = 1;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public static PlantConfigResult Parse(string json)
    {
        PlantDocument? document;
        try
        {
            document = JsonSerializer.Deserialize<PlantDocument>(json, JsonOptions);
        }
        catch (JsonException ex)
        {
            return PlantConfigResult.Failure([ToConfigError(ex)]);
        }

        if (document is null)
        {
            return PlantConfigResult.Failure([new ConfigError("$", "Document is empty.")]);
        }

        var builder = new Builder();
        var plant = builder.Build(document);
        return builder.Errors.Count == 0 && plant is not null
            ? PlantConfigResult.Success(plant)
            : PlantConfigResult.Failure(builder.Errors);
    }

    public static async Task<PlantConfigResult> ParseAsync(Stream utf8Json, CancellationToken cancellationToken = default)
    {
        using var reader = new StreamReader(utf8Json);
        return Parse(await reader.ReadToEndAsync(cancellationToken).ConfigureAwait(false));
    }

    private static ConfigError ToConfigError(JsonException ex)
    {
        // The default message leaks .NET type names; report a location the author can act on.
        var line = (ex.LineNumber ?? 0) + 1;
        var column = (ex.BytePositionInLine ?? 0) + 1;
        return new ConfigError(
            string.IsNullOrEmpty(ex.Path) ? "$" : ex.Path,
            $"Invalid JSON syntax or wrong value type at line {line}, column {column}.");
    }

    [GeneratedRegex("^[a-z0-9]+(?:[-_.][a-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex IdPattern();

    private sealed class Builder
    {
        private readonly List<ConfigError> _errors = [];

        // id -> path of first use, one namespace per entity kind.
        private readonly Dictionary<string, string> _floorIds = new(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _groupIds = new(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _equipmentIds = new(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _tagIds = new(StringComparer.Ordinal);
        private readonly Dictionary<int, string> _floorLevels = [];

        public List<ConfigError> Errors => _errors;

        public PlantModel? Build(PlantDocument doc)
        {
            ReportUnknownProperties(doc, "$");

            var schemaVersion = doc.SchemaVersion ?? CurrentSchemaVersion;
            if (schemaVersion != CurrentSchemaVersion)
            {
                Error("$.schemaVersion", $"Unsupported schema version {schemaVersion}; expected {CurrentSchemaVersion}.");
            }

            if (doc.Site is null)
            {
                Error("$.site", "Required.");
                return null;
            }

            var site = BuildSite(doc.Site, "$.site");
            return site is null ? null : new PlantModel(schemaVersion, site);
        }

        private Site? BuildSite(SiteDocument doc, string path)
        {
            ReportUnknownProperties(doc, path);
            var id = RequireId(doc.Id, path);
            var name = RequireText(doc.Name, $"{path}.name");

            var floors = BuildList(doc.Floors, $"{path}.floors", BuildFloor, requireNonEmpty: true);

            return id is null || name is null || floors is null
                ? null
                : new Site(id, name, NullIfBlank(doc.Location), floors);
        }

        private Floor? BuildFloor(FloorDocument doc, string path)
        {
            ReportUnknownProperties(doc, path);
            var id = RequireId(doc.Id, path, _floorIds, "floor");
            var name = RequireText(doc.Name, $"{path}.name");

            var level = doc.Level ?? 0;
            if (!_floorLevels.TryAdd(level, path))
            {
                Error($"{path}.level", $"Level {level} is already used by {_floorLevels[level]}.");
            }

            FloorSize? size = null;
            if (doc.Size is null)
            {
                Error($"{path}.size", "Required ({ \"width\": ..., \"depth\": ... } in metres).");
            }
            else
            {
                ReportUnknownProperties(doc.Size, $"{path}.size");
                var width = RequirePositive(doc.Size.Width, $"{path}.size.width");
                var depth = RequirePositive(doc.Size.Depth, $"{path}.size.depth");
                if (width is not null && depth is not null)
                {
                    size = new FloorSize(width.Value, depth.Value);
                }
            }

            var groups = BuildList(doc.Groups, $"{path}.groups", (g, p) => BuildGroup(g, p, size), requireNonEmpty: false);

            return id is null || name is null || size is null || groups is null
                ? null
                : new Floor(id, name, level, size, groups);
        }

        private EquipmentGroup? BuildGroup(GroupDocument doc, string path, FloorSize? floorSize)
        {
            ReportUnknownProperties(doc, path);
            var id = RequireId(doc.Id, path, _groupIds, "group");
            var name = RequireText(doc.Name, $"{path}.name");
            var equipment = BuildList(doc.Equipment, $"{path}.equipment", (e, p) => BuildEquipment(e, p, floorSize), requireNonEmpty: false);

            return id is null || name is null || equipment is null
                ? null
                : new EquipmentGroup(id, name, equipment);
        }

        private Equipment? BuildEquipment(EquipmentDocument doc, string path, FloorSize? floorSize)
        {
            ReportUnknownProperties(doc, path);
            var id = RequireId(doc.Id, path, _equipmentIds, "equipment");
            var name = RequireText(doc.Name, $"{path}.name");
            var manufacturer = RequireText(doc.Manufacturer, $"{path}.manufacturer");
            var model = RequireText(doc.Model, $"{path}.model");
            var type = RequireEnum<EquipmentType>(doc.Type, $"{path}.type");

            EquipmentShape? shape = doc.Shape is null
                ? type is null ? null : DefaultShape(type.Value)
                : RequireEnum<EquipmentShape>(doc.Shape, $"{path}.shape");

            var placement = BuildPlacement(doc, path, shape, floorSize);
            var tags = BuildList(doc.Tags, $"{path}.tags", BuildTag, requireNonEmpty: false);

            if (id is null || name is null || manufacturer is null || model is null || type is null
                || placement is null || tags is null)
            {
                return null;
            }

            return new Equipment(id, name, type.Value, manufacturer, model, NullIfBlank(doc.Description), placement, tags);
        }

        private Placement? BuildPlacement(EquipmentDocument doc, string path, EquipmentShape? shape, FloorSize? floorSize)
        {
            Vector3? position = null;
            if (doc.Position is null)
            {
                Error($"{path}.position", "Required ({ \"x\": ..., \"z\": ... } in metres from the floor origin).");
            }
            else
            {
                ReportUnknownProperties(doc.Position, $"{path}.position");
                var x = RequireNumber(doc.Position.X, $"{path}.position.x");
                var z = RequireNumber(doc.Position.Z, $"{path}.position.z");
                if (x is not null && z is not null)
                {
                    position = new Vector3(x.Value, doc.Position.Y ?? 0, z.Value);
                }
            }

            Vector3? size = null;
            if (doc.Size is null)
            {
                Error($"{path}.size", "Required ({ \"x\": ..., \"y\": ..., \"z\": ... } in metres).");
            }
            else
            {
                ReportUnknownProperties(doc.Size, $"{path}.size");
                var x = RequirePositive(doc.Size.X, $"{path}.size.x");
                var y = RequirePositive(doc.Size.Y, $"{path}.size.y");
                var z = RequirePositive(doc.Size.Z, $"{path}.size.z");
                if (x is not null && y is not null && z is not null)
                {
                    size = new Vector3(x.Value, y.Value, z.Value);
                }
            }

            var rotation = doc.Rotation ?? 0;

            if (position is { } p && size is { } s && floorSize is not null)
            {
                RequireInsideFloor(p, s, rotation, floorSize, path);
            }

            return position is null || size is null || shape is null
                ? null
                : new Placement(position.Value, size.Value, rotation, shape.Value);
        }

        private void RequireInsideFloor(Vector3 position, Vector3 size, double rotationDeg, FloorSize floor, string path)
        {
            // Axis-aligned half extents of the rotated footprint.
            var radians = rotationDeg * Math.PI / 180;
            var cos = Math.Abs(Math.Cos(radians));
            var sin = Math.Abs(Math.Sin(radians));
            var halfX = ((cos * size.X) + (sin * size.Z)) / 2;
            var halfZ = ((sin * size.X) + (cos * size.Z)) / 2;

            const double tolerance = 1e-6;
            var outside = position.X - halfX < -tolerance
                || position.X + halfX > floor.Width + tolerance
                || position.Z - halfZ < -tolerance
                || position.Z + halfZ > floor.Depth + tolerance;

            if (outside)
            {
                Error($"{path}.position", string.Create(
                    CultureInfo.InvariantCulture,
                    $"Footprint at ({position.X}, {position.Z}) with size {size.X} x {size.Z} extends outside the floor (0..{floor.Width}, 0..{floor.Depth})."));
            }
        }

        private Tag? BuildTag(TagDocument doc, string path)
        {
            ReportUnknownProperties(doc, path);
            var id = RequireId(doc.Id, path, _tagIds, "tag");
            var name = RequireText(doc.Name, $"{path}.name");
            var unit = RequireText(doc.Unit, $"{path}.unit");
            var min = RequireNumber(doc.NominalMin, $"{path}.nominalMin");
            var max = RequireNumber(doc.NominalMax, $"{path}.nominalMax");

            if (min is not null && max is not null)
            {
                if (min >= max)
                {
                    Error($"{path}.nominalMax", $"Must be greater than nominalMin ({Format(min.Value)}).");
                }

                if (doc.AlarmLow is { } alarmLow && alarmLow >= min)
                {
                    Error($"{path}.alarmLow", $"Must be below nominalMin ({Format(min.Value)}).");
                }

                if (doc.AlarmHigh is { } alarmHigh && alarmHigh <= max)
                {
                    Error($"{path}.alarmHigh", $"Must be above nominalMax ({Format(max.Value)}).");
                }
            }

            return id is null || name is null || unit is null || min is null || max is null
                ? null
                : new Tag(id, name, unit, min.Value, max.Value, doc.AlarmLow, doc.AlarmHigh);
        }

        private List<TOut>? BuildList<TIn, TOut>(
            List<TIn?>? items,
            string path,
            Func<TIn, string, TOut?> build,
            bool requireNonEmpty)
            where TIn : class
            where TOut : class
        {
            if (items is null || items.Count == 0)
            {
                if (requireNonEmpty)
                {
                    Error(path, "At least one entry is required.");
                    return null;
                }

                return [];
            }

            var result = new List<TOut>(items.Count);
            var ok = true;
            for (var i = 0; i < items.Count; i++)
            {
                var itemPath = $"{path}[{i}]";
                if (items[i] is not { } item)
                {
                    Error(itemPath, "Entry must be an object, not null.");
                    ok = false;
                    continue;
                }

                if (build(item, itemPath) is { } built)
                {
                    result.Add(built);
                }
                else
                {
                    ok = false;
                }
            }

            return ok ? result : null;
        }

        private string? RequireId(string? id, string path, Dictionary<string, string>? seen = null, string? kind = null)
        {
            var idPath = $"{path}.id";
            if (string.IsNullOrWhiteSpace(id))
            {
                Error(idPath, "Required.");
                return null;
            }

            if (!IdPattern().IsMatch(id))
            {
                Error(idPath, $"'{id}' is not a valid id. Use lowercase letters and digits separated by '-', '_' or '.'.");
                return null;
            }

            if (seen is not null && !seen.TryAdd(id, path))
            {
                Error(idPath, $"Duplicate {kind} id '{id}', already used at {seen[id]}.");
                return null;
            }

            return id;
        }

        private string? RequireText(string? value, string path)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                Error(path, "Required.");
                return null;
            }

            return value.Trim();
        }

        private double? RequireNumber(double? value, string path)
        {
            if (value is null)
            {
                Error(path, "Required.");
            }

            return value;
        }

        private double? RequirePositive(double? value, string path)
        {
            if (RequireNumber(value, path) is not { } number)
            {
                return null;
            }

            if (number <= 0)
            {
                Error(path, $"Must be greater than 0 (was {Format(number)}).");
                return null;
            }

            return number;
        }

        private TEnum? RequireEnum<TEnum>(string? value, string path)
            where TEnum : struct, Enum
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                Error(path, $"Required. Allowed values: {string.Join(", ", EnumNames<TEnum>.Values.Keys)}.");
                return null;
            }

            if (EnumNames<TEnum>.Values.TryGetValue(value, out var parsed))
            {
                return parsed;
            }

            Error(path, $"Unknown value '{value}'. Allowed values: {string.Join(", ", EnumNames<TEnum>.Values.Keys)}.");
            return null;
        }

        private void ReportUnknownProperties(DocumentBase doc, string path)
        {
            if (doc.UnknownProperties is null)
            {
                return;
            }

            foreach (var name in doc.UnknownProperties.Keys)
            {
                Error($"{path}.{name}", "Unknown property. Check the spelling (property names are camelCase).");
            }
        }

        private void Error(string path, string message) => _errors.Add(new ConfigError(path, message));

        private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static string Format(double value) => value.ToString(CultureInfo.InvariantCulture);

        private static EquipmentShape DefaultShape(EquipmentType type) => type switch
        {
            EquipmentType.Pump or EquipmentType.Motor or EquipmentType.HeatExchanger => EquipmentShape.HorizontalCylinder,
            EquipmentType.Tank or EquipmentType.Fan => EquipmentShape.Cylinder,
            EquipmentType.Valve => EquipmentShape.Sphere,
            _ => EquipmentShape.Box,
        };
    }

    /// <summary>Kebab-case names for enum values, matching how the API serializes them ("heat-exchanger").</summary>
    private static class EnumNames<TEnum>
        where TEnum : struct, Enum
    {
        public static readonly IReadOnlyDictionary<string, TEnum> Values = Enum.GetValues<TEnum>()
            .ToDictionary(v => JsonNamingPolicy.KebabCaseLower.ConvertName(v.ToString()), v => v, StringComparer.Ordinal);
    }
}
