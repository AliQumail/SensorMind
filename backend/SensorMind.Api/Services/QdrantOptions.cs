using System.ComponentModel.DataAnnotations;

namespace SensorMind.Api.Services;

public sealed class QdrantOptions
{
    public const string SectionName = "Qdrant";

    // gRPC endpoint on port 6334 (local or Qdrant Cloud URL).
    [Required]
    public string Url { get; set; } = string.Empty;

    // Needed for Qdrant Cloud; empty locally.
    public string? ApiKey { get; set; }

    [Required]
    public string Collection { get; set; } = "manuals";

    // Must match the embedding model's output size.
    [Range(1, 65536)]
    public int VectorSize { get; set; } = 1536;
}
