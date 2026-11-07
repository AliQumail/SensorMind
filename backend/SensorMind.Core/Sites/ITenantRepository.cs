namespace SensorMind.Core.Sites;

public interface ITenantRepository
{
    IReadOnlyList<Tenant> GetTenants();

    IReadOnlyList<SiteEntry> GetSites();

    /// <summary>Creates or replaces a tenant and all its sites in one transaction, so a failure leaves nothing half saved.</summary>
    void SaveTenant(Tenant tenant, IReadOnlyList<SiteEntry> sites);

    void DeleteTenant(string id);
}
