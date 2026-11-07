# Plant configuration format

A plant is one JSON file: **Site → Floors → Assets → Tags**. The API loads it at startup from `Plant:ConfigPath` (env `Plant__ConfigPath`) when the database is empty, and the same format is used for the sites stored per tenant. If the file is invalid, the API refuses to start and lists every error. [`data/plant.sample.json`](../data/plant.sample.json) is a complete example.

## The four levels

| Level | Meaning in SensorMind | Example |
|-------|-----------------------|---------|
| **Site** | The plant as a whole. | Walnut Berlin Mitte |
| **Floor** | One level of the building, drawn in its own 3D view. | Sales Floor |
| **Asset** | A machine you monitor, such as a refrigerated cabinet. It is the unit you select in the tree or the 3D view, and the one you ask the assistant about. | Chilled Cabinet R-01 |
| **Tag** | One sensor signal on an asset, with a unit and nominal and alarm limits. | Cabinet Temperature (°C) |

```mermaid
flowchart TD
  S["Site: Walnut Berlin Mitte"] --> F["Floor: Sales Floor"]
  F --> A["Asset: Chilled Cabinet R-01"]
  A --> T["Tag: Cabinet Temperature, °C, nominal 1 to 4, alarm above 7"]
```

To check a file without restarting the API:

```bash
curl -X POST http://localhost:5080/api/plant/validate \
  -H "Content-Type: application/json" --data-binary @my-plant.json
```

```json
{ "valid": false, "errors": [
  { "path": "$.site.floors[0].assets[1].tags[2].alarmHigh", "message": "Must be above nominalMax (4)." }
] }
```

## Shape

```jsonc
{
  "schemaVersion": 1,                       // optional, defaults to 1
  "site": {
    "id": "site-walnut-berlin-mitte", "name": "Walnut Berlin Mitte", "location": "optional",
    "floors": [{
      "id": "floor-sales", "name": "Sales Floor", "level": 0,
      "size": { "width": 30, "depth": 8 },  // metres
      "assets": [{
        "id": "r-01", "name": "Chilled Cabinet R-01",
        "type": "refrigerator", "manufacturer": "Generic", "model": "Chilled cabinet",
        "description": "optional",
        "position": { "x": 2.2, "z": 4 },    // footprint centre from the floor corner; optional "y" = base elevation
        "size": { "x": 2.4, "y": 2, "z": 0.9 },
        "rotation": 0,                     // optional, degrees around the vertical axis
        "shape": "box",                    // optional, defaults by type
        "tags": [{
          "id": "r-01.cabinet-temp", "name": "Cabinet Temperature", "unit": "°C",
          "nominalMin": 1, "nominalMax": 4,
          "alarmHigh": 7                   // optional; alarmLow likewise
        }]
      }]
    }]
  }
}
```

## Rules

- **Ids** are lowercase letters and digits separated by `-`, `_` or `.`. They must be unique across the whole plant for each kind (floors, assets, tags).
- **Floor `level`** must be unique.
- **`type`** is one of `refrigerator`, `pump`, `compressor`, `motor`, `tank`, `fan`, `valve`, `heat-exchanger`, `other`.
- **`shape`** is one of `box`, `cylinder`, `horizontal-cylinder`, `sphere`. The default is a horizontal cylinder for pumps, motors and heat exchangers, a cylinder for tanks and fans, a sphere for valves, and a box otherwise.
- **Sizes** must be greater than 0. The rotated footprint must fit inside the floor.
- **Tags:** `nominalMin < nominalMax`. If set, `alarmLow < nominalMin` and `alarmHigh > nominalMax`.
- **Status:** inside the nominal band is *normal*, outside it is *warning*, and at or beyond an alarm limit is *alarm*.
- **Unknown properties are rejected** so that typos surface. Comments and trailing commas are allowed.

## Stored sites from before the Floor > Asset change

Earlier versions stored `floors[].groups[].equipment[]`. The API now stops at startup with an error that names the site if a stored row still has that shape. Convert the rows once on your own database (back it up first); the statement does nothing to rows that are already converted:

```sql
UPDATE sites s SET config_json = (
  SELECT jsonb_set(
    s.config_json::jsonb, '{site,floors}',
    COALESCE(jsonb_agg(
      CASE WHEN f.fl ? 'groups'
        THEN (f.fl - 'groups') || jsonb_build_object('assets', COALESCE((
               SELECT jsonb_agg(a.asset ORDER BY g.gi, a.ai)
               FROM jsonb_array_elements(f.fl -> 'groups') WITH ORDINALITY AS g(grp, gi),
                    jsonb_array_elements(g.grp -> 'equipment') WITH ORDINALITY AS a(asset, ai)
             ), '[]'::jsonb))
        ELSE f.fl END
      ORDER BY f.fi), '[]'::jsonb))::text
  FROM jsonb_array_elements(s.config_json::jsonb #> '{site,floors}') WITH ORDINALITY AS f(fl, fi)
)
WHERE s.config_json::jsonb #> '{site,floors}' @? '$[*].groups';
```

For the Docker database in `docker-compose.yml`, save the statement as `convert.sql` and run `docker compose exec -T postgres psql -U sensormind -d sensormind < convert.sql`. Group names are dropped; assets keep their order. A fresh database is seeded from the new sample and needs nothing.
