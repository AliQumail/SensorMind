using System.ComponentModel.DataAnnotations;

namespace SensorMind.Infrastructure.Manuals;

public sealed class QdrantOptions
{
    public const string SectionName = "Qdrant";

    /// <summary>gRPC endpoint, e.g. http://localhost:6334 locally or the Qdrant Cloud URL on port 6334.</summary>
    [Required]
    public string Url { get; set; } = string.Empty;

    /// <summary>Needed for Qdrant Cloud; empty for the local container.</summary>
    public string? ApiKey { get; set; }

    [Required]
    public string Collection { get; set; } = "manuals";

    /// <summary>Must match the embedding model's output size.</summary>
    [Range(1, 65536)]
    public int VectorSize { get; set; } = 1536;
}
