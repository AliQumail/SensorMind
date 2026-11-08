using System.Globalization;
using System.Text;
using SensorMind.Core.Plant;
using SensorMind.Core.Sensors;
using SensorMind.Infrastructure.Manuals;

namespace SensorMind.Api.Chat;

// Rules, tag list, live readings with a short trend for relevant assets, and manual excerpts.
internal static class ChatPrompt
{
    private static readonly TimeSpan TrendWindow = TimeSpan.FromMinutes(15);
    private const int MaxFallbackAssets = 8;

    private const string Rules = """
        You are SensorMind, an assistant inside an industrial IoT sensor intelligence platform.
        Rules:
        - Answer only from the context below: numbered manual excerpts and live sensor data.
        - When you use a manual excerpt, cite it by its number in square brackets, for example [2]. Never invent citations.
        - If the answer comes only from sensor data, say so. If neither the manual excerpts nor the sensor data answer the question, say you do not have enough information. Do not guess.
        - Keep answers short and use Markdown.
        - To show a trend graph, put a fenced block on its own lines, using a tag id from the tag list and a window in minutes (5 to 240), for example:
        ```chart
        {"tagId":"r-01.cabinet-temp","minutes":60}
        ```
          Use at most two chart blocks, and only when the user asks for a trend, graph or history.
        """;

    public static string Build(
        IReadOnlyCollection<PlantIndex> plants,
        ISensorStore store,
        DateTimeOffset now,
        string question,
        Asset? selected,
        IReadOnlyList<ManualMatch> manualMatches)
    {
        var text = new StringBuilder(Rules).AppendLine().AppendLine();

        var all = plants.SelectMany(p => p.Plant.Site.Floors.SelectMany(f => f.Assets.Select(e => (Asset: e, Floor: f)))).ToList();

        text.AppendLine("Tag list (id: asset, tag, unit):");
        foreach (var (asset, _) in all)
        {
            foreach (var tag in asset.Tags)
            {
                text.AppendLine(CultureInfo.InvariantCulture, $"- {tag.Id}: {asset.Name}, {tag.Name}, {tag.Unit}");
            }
        }

        text.AppendLine().AppendLine(CultureInfo.InvariantCulture, $"Live sensor data at {now:u}:");
        var relevant = RelevantAsset(all, store, question, selected);
        if (relevant.Count == 0)
        {
            text.AppendLine("- No sensor readings are available yet.");
        }

        foreach (var (asset, floor) in relevant)
        {
            text.AppendLine(CultureInfo.InvariantCulture, $"{asset.Name} ({asset.Manufacturer} {asset.Model}, {floor.Name}):");
            foreach (var tag in asset.Tags)
            {
                text.AppendLine(CultureInfo.InvariantCulture, $"- {tag.Name} [{tag.Id}]: {Describe(tag, store, now)}");
            }
        }

        text.AppendLine().AppendLine("Manual excerpts:");
        if (manualMatches.Count == 0)
        {
            text.AppendLine("- None available for this question.");
        }

        for (var i = 0; i < manualMatches.Count; i++)
        {
            var chunk = manualMatches[i].Chunk;
            text.AppendLine(CultureInfo.InvariantCulture, $"[{i + 1}] ({chunk.SourceFile}, page {chunk.Page})").AppendLine(chunk.Text).AppendLine();
        }

        return text.ToString();
    }

    // Selected asset and any asset named in the question; with neither, assets in warning or alarm.
    private static List<(Asset Asset, Floor Floor)> RelevantAsset(
        List<(Asset Asset, Floor Floor)> all, ISensorStore store, string question, Asset? selected)
    {
        var chosen = all
            .Where(x => x.Asset.Id == selected?.Id ||
                        question.Contains(x.Asset.Id, StringComparison.OrdinalIgnoreCase) ||
                        question.Contains(x.Asset.Name, StringComparison.OrdinalIgnoreCase))
            .ToList();

        return chosen.Count > 0
            ? chosen
            : [.. all
                .Where(x => x.Asset.Tags.Any(t => store.TryGetLatest(t.Id, out var r) && r.Status != TagStatus.Normal))
                .Take(MaxFallbackAssets)];
    }

    private static string Describe(Tag tag, ISensorStore store, DateTimeOffset now)
    {
        if (!store.TryGetLatest(tag.Id, out var latest))
        {
            return "no reading yet";
        }

        var inv = CultureInfo.InvariantCulture;
        var summary = $"{latest.Value.ToString("0.##", inv)} {tag.Unit}, {latest.Status.ToString().ToLowerInvariant()} (nominal {tag.NominalMin.ToString("0.##", inv)} to {tag.NominalMax.ToString("0.##", inv)})";

        var history = store.GetHistory(tag.Id, now - TrendWindow, now);
        if (history.Count < 2)
        {
            return summary;
        }

        var span = tag.NominalMax - tag.NominalMin;
        var change = history[^1].Value - history[0].Value;
        var direction = Math.Abs(change) < span * 0.05 ? "steady" : change > 0 ? "rising" : "falling";
        return $"{summary}; last 15 min: {direction}, min {history.Min(p => p.Value).ToString("0.##", inv)}, max {history.Max(p => p.Value).ToString("0.##", inv)}, avg {history.Average(p => p.Value).ToString("0.##", inv)}";
    }
}
