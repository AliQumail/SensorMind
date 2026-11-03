using SensorMind.Core.Plant;

namespace SensorMind.Infrastructure.Plant;

public sealed class PlantConfigException(string path, IReadOnlyList<ConfigError> errors)
    : Exception($"Plant config '{path}' is invalid:{Environment.NewLine}  {string.Join($"{Environment.NewLine}  ", errors)}")
{
    public IReadOnlyList<ConfigError> Errors { get; } = errors;
}

public static class PlantConfigLoader
{
    /// <summary>Loads and validates the plant file, throwing with every validation error listed so startup fails loudly.</summary>
    public static PlantModel LoadFromFile(string path)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Plant config not found at '{Path.GetFullPath(path)}'. Set Plant__ConfigPath.", path);
        }

        var result = PlantConfigParser.Parse(File.ReadAllText(path));
        return result.Plant ?? throw new PlantConfigException(path, result.Errors);
    }
}
