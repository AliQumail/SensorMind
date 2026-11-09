using SensorMind.Api.Repositories;
using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using UglyToad.PdfPig;

namespace SensorMind.Api.Services;

public sealed class ManualsOptions
{
    public const string SectionName = "Manuals";

    // Relative to the API content root.
    public string Path { get; set; } = "data/manuals";
}

// Skips documents whose hash is stored; problems are logged and skipped so the API still starts.
public sealed class ManualIngestionService(
    PlantCatalog catalog,
    ManualVectorStore store,
    OpenRouterClient openRouter,
    IOptions<ManualsOptions> options,
    IHostEnvironment environment,
    ILogger<ManualIngestionService> logger) : BackgroundService
{
    private const int EmbedBatchSize = 32;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await IngestAllAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            logger.LogWarning("Manual ingestion stopped: {Message}", ex.Message);
        }
    }

    private async Task IngestAllAsync(CancellationToken ct)
    {
        var folder = Path.Combine(environment.ContentRootPath, options.Value.Path);
        var files = Directory.Exists(folder) ? Directory.GetFiles(folder, "*.pdf") : [];
        if (files.Length == 0)
        {
            logger.LogInformation("No manual PDFs in {Folder}; skipping ingestion.", folder);
            return;
        }

        if (!openRouter.HasConfiguredKey)
        {
            logger.LogWarning("OpenRouter:ApiKey is not set; skipping manual ingestion.");
            return;
        }

        await store.EnsureCollectionAsync(ct);
        foreach (var file in files)
        {
            try
            {
                await IngestFileAsync(file, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning("Could not ingest {File}: {Message}", Path.GetFileName(file), ex.Message);
            }
        }
    }

    private async Task IngestFileAsync(string path, CancellationToken ct)
    {
        var name = Path.GetFileName(path);
        var hash = Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(path, ct)));
        if (await store.HasDocumentAsync(hash, ct))
        {
            logger.LogInformation("{File} is already ingested; skipping.", name);
            return;
        }

        var (manufacturer, model) = InferAsset(name);
        var chunks = new List<ManualChunk>();
        using (var pdf = PdfDocument.Open(path))
        {
            foreach (var page in pdf.GetPages())
            {
                chunks.AddRange(ManualChunker.Split(page.Text).Select(text => new ManualChunk(text, name, page.Number, hash, manufacturer, model)));
            }
        }

        if (chunks.Count == 0)
        {
            logger.LogWarning("{File} has no extractable text (scanned PDF?); skipping.", name);
            return;
        }

        for (var i = 0; i < chunks.Count; i += EmbedBatchSize)
        {
            var batch = chunks.Skip(i).Take(EmbedBatchSize).ToList();
            var vectors = await openRouter.EmbedAsync([.. batch.Select(c => c.Text)], ct: ct);
            await store.UpsertAsync([.. batch.Zip(vectors, (chunk, vector) => (chunk, vector))], ct);
        }

        logger.LogInformation("Ingested {File}: {Count} chunks.", name, chunks.Count);
    }

    // Manufacturer (and model) of plant assets that the file name mentions.
    private (string? Manufacturer, string? Model) InferAsset(string fileName)
    {
        var key = Normalize(Path.GetFileNameWithoutExtension(fileName));
        var assets = catalog.Plants.SelectMany(p => p.Assets).ToList();
        var manufacturer = assets.Select(e => e.Manufacturer).Distinct().FirstOrDefault(m => key.Contains(Normalize(m)));
        var model = assets.Where(e => e.Manufacturer == manufacturer).Select(e => e.Model).Distinct().FirstOrDefault(m => key.Contains(Normalize(m)));
        return (manufacturer, model);
    }

    private static string Normalize(string value) => new([.. value.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant)]);
}
