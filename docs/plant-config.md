# Plant configuration format

A plant is one JSON file: **Site → Floors → Groups → Equipment → Tags**. The API loads it at startup from `Plant:ConfigPath` (env `Plant__ConfigPath`). If the file is invalid, the API refuses to start and lists every error. [`data/plant.sample.json`](../data/plant.sample.json) is a complete example.

To check a file without restarting the API:

```bash
curl -X POST http://localhost:5080/api/plant/validate \
  -H "Content-Type: application/json" --data-binary @my-plant.json
```

```json
{ "valid": false, "errors": [
  { "path": "$.site.floors[0].groups[0].equipment[1].tags[2].alarmHigh", "message": "Must be above nominalMax (62)." }
] }
```

## Shape

```jsonc
{
  "schemaVersion": 1,                       // optional, defaults to 1
  "site": {
    "id": "site-harbor", "name": "Harbor Works", "location": "optional",
    "floors": [{
      "id": "floor-ground", "name": "Ground Floor", "level": 0,
      "size": { "width": 30, "depth": 18 },  // metres
      "groups": [{
        "id": "grp-cooling-water", "name": "Cooling Water",
        "equipment": [{
          "id": "p-101", "name": "Cooling Water Pump P-101",
          "type": "pump", "manufacturer": "Grundfos", "model": "CR 32-2",
          "description": "optional",
          "position": { "x": 5, "z": 5 },    // footprint centre from the floor corner; optional "y" = base elevation
          "size": { "x": 0.7, "y": 1.5, "z": 0.7 },
          "rotation": 0,                     // optional, degrees around the vertical axis
          "shape": "cylinder",               // optional, defaults by type
          "tags": [{
            "id": "p-101.bearing-temp", "name": "Bearing Temperature", "unit": "°C",
            "nominalMin": 42, "nominalMax": 62,
            "alarmHigh": 80                  // optional; alarmLow likewise
          }]
        }]
      }]
    }]
  }
}
```

## Rules

- **Ids** are lowercase letters and digits separated by `-`, `_` or `.`. They must be unique across the whole plant for each kind (floors, groups, equipment, tags).
- **Floor `level`** must be unique.
- **`type`** is one of `pump`, `compressor`, `motor`, `tank`, `fan`, `valve`, `heat-exchanger`, `other`.
- **`shape`** is one of `box`, `cylinder`, `horizontal-cylinder`, `sphere`. The default is a horizontal cylinder for pumps, motors and heat exchangers, a cylinder for tanks and fans, a sphere for valves, and a box otherwise.
- **Sizes** must be greater than 0. The rotated footprint must fit inside the floor.
- **Tags:** `nominalMin < nominalMax`. If set, `alarmLow < nominalMin` and `alarmHigh > nominalMax`.
- **Status:** inside the nominal band is *normal*, outside it is *warning*, and at or beyond an alarm limit is *alarm*.
- **Unknown properties are rejected** so that typos surface. Comments and trailing commas are allowed.
