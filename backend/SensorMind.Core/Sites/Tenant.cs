namespace SensorMind.Core.Sites;

public sealed record Tenant(string Id, string Name);

public sealed record SiteEntry(string Id, string TenantId, string Name, string ConfigJson);
