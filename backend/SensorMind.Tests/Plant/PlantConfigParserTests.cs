using System.Text.Json.Nodes;
using SensorMind.Core.Plant;

namespace SensorMind.Tests.Plant;

public class PlantConfigParserTests
{
    private const string MinimalPlant = """
        {
          "schemaVersion": 1,
          "site": {
            "id": "site-1",
            "name": "Test Site",
            "floors": [
              {
                "id": "floor-1",
                "name": "Ground",
                "level": 0,
                "size": { "width": 20, "depth": 10 },
                "groups": [
                  {
                    "id": "grp-1",
                    "name": "Group",
                    "equipment": [
                      {
                        "id": "p-1",
                        "name": "Pump 1",
                        "type": "pump",
                        "manufacturer": "Grundfos",
                        "model": "CR 32-2",
                        "position": { "x": 5, "z": 5 },
                        "size": { "x": 1, "y": 1.5, "z": 1 },
                        "tags": [
                          { "id": "p-1.pressure", "name": "Pressure", "unit": "bar", "nominalMin": 3, "nominalMax": 5, "alarmLow": 2, "alarmHigh": 6 }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
        """;

    [Fact]
    public void Parses_minimal_valid_plant()
    {
        var result = PlantConfigParser.Parse(MinimalPlant);

        Assert.True(result.IsValid, string.Join(Environment.NewLine, result.Errors));
        var equipment = Assert.Single(result.Plant!.Site.Floors[0].Groups[0].Equipment);
        Assert.Equal(EquipmentType.Pump, equipment.Type);
        Assert.Equal(new Vector3(5, 0, 5), equipment.Placement.Position);
        var tag = Assert.Single(equipment.Tags);
        Assert.Equal(6, tag.AlarmHigh);
    }

    [Fact]
    public void Sample_plant_file_is_valid()
    {
        var json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "plant.sample.json"));

        var result = PlantConfigParser.Parse(json);

        Assert.True(result.IsValid, string.Join(Environment.NewLine, result.Errors));
        Assert.Equal(2, result.Plant!.Site.Floors.Count);
        var equipment = result.Plant.Site.Floors.SelectMany(f => f.Groups).SelectMany(g => g.Equipment).ToList();
        Assert.InRange(equipment.Count, 8, 12);
        Assert.All(equipment, e => Assert.InRange(e.Tags.Count, 3, 5));
    }

    [Theory]
    [InlineData("pump", EquipmentShape.HorizontalCylinder)]
    [InlineData("tank", EquipmentShape.Cylinder)]
    [InlineData("compressor", EquipmentShape.Box)]
    public void Shape_defaults_from_equipment_type(string type, EquipmentShape expected)
    {
        var json = Mutate(doc => Equipment(doc)["type"] = type);

        var result = PlantConfigParser.Parse(json);

        Assert.Equal(expected, result.Plant!.Site.Floors[0].Groups[0].Equipment[0].Placement.Shape);
    }

    [Fact]
    public void Accepts_kebab_case_enum_values()
    {
        var json = Mutate(doc =>
        {
            Equipment(doc)["type"] = "heat-exchanger";
            Equipment(doc)["shape"] = "horizontal-cylinder";
        });

        var result = PlantConfigParser.Parse(json);

        Assert.True(result.IsValid, string.Join(Environment.NewLine, result.Errors));
        Assert.Equal(EquipmentType.HeatExchanger, result.Plant!.Site.Floors[0].Groups[0].Equipment[0].Type);
    }

    [Fact]
    public void Reports_malformed_json_with_location()
    {
        var result = PlantConfigParser.Parse("{ \"site\": { \"id\": ");

        var error = Assert.Single(result.Errors);
        Assert.Contains("line 1", error.Message, StringComparison.Ordinal);
        Assert.False(result.IsValid);
    }

    [Fact]
    public void Reports_wrong_value_type_with_path()
    {
        var json = Mutate(doc => Tag(doc)["nominalMin"] = "three");

        var error = Assert.Single(PlantConfigParser.Parse(json).Errors);

        Assert.Equal("$.site.floors[0].groups[0].equipment[0].tags[0].nominalMin", error.Path);
    }

    [Fact]
    public void Reports_missing_site()
    {
        var error = Assert.Single(PlantConfigParser.Parse("""{ "schemaVersion": 1 }""").Errors);

        Assert.Equal("$.site", error.Path);
    }

    [Fact]
    public void Reports_unsupported_schema_version()
    {
        var json = Mutate(doc => doc["schemaVersion"] = 2);

        AssertSingleError(json, "$.schemaVersion", "Unsupported schema version");
    }

    [Fact]
    public void Requires_at_least_one_floor()
    {
        var json = Mutate(doc => doc["site"]!["floors"] = new JsonArray());

        AssertSingleError(json, "$.site.floors", "At least one");
    }

    [Fact]
    public void Collects_all_missing_required_fields()
    {
        var json = Mutate(doc =>
        {
            var equipment = Equipment(doc);
            equipment.Remove("name");
            equipment.Remove("manufacturer");
            equipment.Remove("model");
            Tag(doc).Remove("unit");
        });

        var paths = PlantConfigParser.Parse(json).Errors.Select(e => e.Path).ToList();

        const string eq = "$.site.floors[0].groups[0].equipment[0]";
        Assert.Equal([$"{eq}.name", $"{eq}.manufacturer", $"{eq}.model", $"{eq}.tags[0].unit"], paths);
    }

    [Theory]
    [InlineData("Pump-1")]
    [InlineData("pump 1")]
    [InlineData("-pump")]
    [InlineData("pump--1")]
    public void Rejects_invalid_ids(string id)
    {
        var json = Mutate(doc => Equipment(doc)["id"] = id);

        AssertSingleError(json, "$.site.floors[0].groups[0].equipment[0].id", "not a valid id");
    }

    [Fact]
    public void Rejects_duplicate_tag_ids_and_points_to_first_use()
    {
        var json = Mutate(doc => ((JsonArray)Equipment(doc)["tags"]!).Add(Tag(doc).DeepClone()));

        var error = AssertSingleError(json, "$.site.floors[0].groups[0].equipment[0].tags[1].id", "Duplicate tag id 'p-1.pressure'");
        Assert.Contains("tags[0]", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Rejects_duplicate_floor_levels()
    {
        var json = Mutate(doc =>
        {
            var floors = (JsonArray)doc["site"]!["floors"]!;
            var copy = floors[0]!.DeepClone();
            copy["id"] = "floor-2";
            copy["groups"] = new JsonArray();
            floors.Add(copy);
        });

        AssertSingleError(json, "$.site.floors[1].level", "already used");
    }

    [Fact]
    public void Rejects_unknown_equipment_type_and_lists_allowed_values()
    {
        var json = Mutate(doc => Equipment(doc)["type"] = "turbine");

        var error = AssertSingleError(json, "$.site.floors[0].groups[0].equipment[0].type", "Unknown value 'turbine'");
        Assert.Contains("heat-exchanger", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Rejects_misspelled_property()
    {
        var json = Mutate(doc => Tag(doc)["nominalMaxx"] = 10);

        AssertSingleError(json, "$.site.floors[0].groups[0].equipment[0].tags[0].nominalMaxx", "Unknown property");
    }

    [Fact]
    public void Rejects_inverted_nominal_band()
    {
        var json = Mutate(doc =>
        {
            Tag(doc)["nominalMin"] = 5;
            Tag(doc)["nominalMax"] = 3;
        });

        Assert.Contains(PlantConfigParser.Parse(json).Errors, e => e.Path.EndsWith(".nominalMax", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("alarmLow", 3.5)]
    [InlineData("alarmHigh", 4.5)]
    public void Rejects_alarm_limits_inside_nominal_band(string property, double value)
    {
        var json = Mutate(doc => Tag(doc)[property] = value);

        AssertSingleError(json, $"$.site.floors[0].groups[0].equipment[0].tags[0].{property}", "Must be");
    }

    [Fact]
    public void Alarm_limits_are_optional()
    {
        var json = Mutate(doc =>
        {
            Tag(doc).Remove("alarmLow");
            Tag(doc).Remove("alarmHigh");
        });

        Assert.True(PlantConfigParser.Parse(json).IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Rejects_non_positive_size(double height)
    {
        var json = Mutate(doc => Equipment(doc)["size"]!["y"] = height);

        AssertSingleError(json, "$.site.floors[0].groups[0].equipment[0].size.y", "greater than 0");
    }

    [Theory]
    [InlineData(19.8, 5, 0)] // sticks out past width 20
    [InlineData(0.2, 5, 0)] // sticks out past 0
    [InlineData(5, 9.9, 0)] // sticks out past depth 10
    public void Rejects_equipment_outside_floor(double x, double z, double rotation)
    {
        var json = Mutate(doc =>
        {
            Equipment(doc)["position"] = new JsonObject { ["x"] = x, ["z"] = z };
            Equipment(doc)["rotation"] = rotation;
        });

        AssertSingleError(json, "$.site.floors[0].groups[0].equipment[0].position", "outside the floor");
    }

    [Fact]
    public void Floor_bounds_account_for_rotation()
    {
        // 4 x 1 footprint at x=18.5 fits when rotated 90 degrees (becomes 1 x 4) but not unrotated.
        static string At(double rotation) => Mutate(doc =>
        {
            Equipment(doc)["size"] = new JsonObject { ["x"] = 4, ["y"] = 1, ["z"] = 1 };
            Equipment(doc)["position"] = new JsonObject { ["x"] = 18.5, ["z"] = 5 };
            Equipment(doc)["rotation"] = rotation;
        });

        Assert.False(PlantConfigParser.Parse(At(0)).IsValid);
        Assert.True(PlantConfigParser.Parse(At(90)).IsValid);
    }

    [Fact]
    public void Rejects_null_list_entries()
    {
        var json = Mutate(doc => ((JsonArray)Equipment(doc)["tags"]!).Add(null));

        AssertSingleError(json, "$.site.floors[0].groups[0].equipment[0].tags[1]", "not null");
    }

    private static ConfigError AssertSingleError(string json, string path, string messageFragment)
    {
        var result = PlantConfigParser.Parse(json);
        Assert.False(result.IsValid);
        var error = Assert.Single(result.Errors);
        Assert.Equal(path, error.Path);
        Assert.Contains(messageFragment, error.Message, StringComparison.Ordinal);
        return error;
    }

    private static string Mutate(Action<JsonObject> change)
    {
        var doc = JsonNode.Parse(MinimalPlant)!.AsObject();
        change(doc);
        return doc.ToJsonString();
    }

    private static JsonObject Equipment(JsonObject doc) =>
        doc["site"]!["floors"]![0]!["groups"]![0]!["equipment"]![0]!.AsObject();

    private static JsonObject Tag(JsonObject doc) => Equipment(doc)["tags"]![0]!.AsObject();
}
