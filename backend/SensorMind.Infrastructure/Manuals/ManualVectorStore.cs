using Microsoft.Extensions.Options;
using Qdrant.Client;
using Qdrant.Client.Grpc;
using static Qdrant.Client.Grpc.Conditions;

namespace SensorMind.Infrastructure.Manuals;

public sealed record ManualChunk(string Text, string SourceFile, int Page, string DocumentHash, string? Manufacturer = null, string? Model = null);

public sealed record ManualMatch(ManualChunk Chunk, float Score);

/// <summary>Manual chunks and their embeddings in a Qdrant collection.</summary>
public sealed class ManualVectorStore(QdrantClient client, IOptions<QdrantOptions> options)
{
    private readonly QdrantOptions _options = options.Value;

    public async Task EnsureCollectionAsync(CancellationToken ct = default)
    {
        if (!await client.CollectionExistsAsync(_options.Collection, ct))
        {
            await client.CreateCollectionAsync(
                _options.Collection,
                new VectorParams { Size = (ulong)_options.VectorSize, Distance = Distance.Cosine },
                cancellationToken: ct);
        }
    }

    public async Task<bool> HasDocumentAsync(string documentHash, CancellationToken ct = default) =>
        await client.CountAsync(_options.Collection, MatchKeyword("document_hash", documentHash), exact: true, cancellationToken: ct) > 0;

    public async Task UpsertAsync(IReadOnlyList<(ManualChunk Chunk, float[] Vector)> chunks, CancellationToken ct = default)
    {
        var points = chunks.Select(c =>
        {
            var point = new PointStruct { Id = Guid.NewGuid(), Vectors = c.Vector };
            point.Payload["text"] = c.Chunk.Text;
            point.Payload["source_file"] = c.Chunk.SourceFile;
            point.Payload["page"] = c.Chunk.Page;
            point.Payload["document_hash"] = c.Chunk.DocumentHash;
            if (c.Chunk.Manufacturer is not null) point.Payload["manufacturer"] = c.Chunk.Manufacturer;
            if (c.Chunk.Model is not null) point.Payload["model"] = c.Chunk.Model;
            return point;
        }).ToList();

        await client.UpsertAsync(_options.Collection, points, cancellationToken: ct);
    }

    public async Task<IReadOnlyList<ManualMatch>> SearchAsync(
        float[] vector, int limit, string? manufacturer = null, string? model = null, CancellationToken ct = default)
    {
        var filter = new Filter();
        if (manufacturer is not null) filter.Must.Add(MatchKeyword("manufacturer", manufacturer));
        if (model is not null) filter.Must.Add(MatchKeyword("model", model));

        var points = await client.SearchAsync(
            _options.Collection, vector, filter: filter.Must.Count > 0 ? filter : null, limit: (ulong)limit, cancellationToken: ct);

        return [.. points.Select(p => new ManualMatch(
            new ManualChunk(
                p.Payload["text"].StringValue,
                p.Payload["source_file"].StringValue,
                (int)p.Payload["page"].IntegerValue,
                p.Payload["document_hash"].StringValue,
                p.Payload.TryGetValue("manufacturer", out var m) ? m.StringValue : null,
                p.Payload.TryGetValue("model", out var mo) ? mo.StringValue : null),
            p.Score))];
    }
}
