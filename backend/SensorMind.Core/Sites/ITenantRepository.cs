namespace SensorMind.Core.Sites;

public interface ITenantRepository
{
    IReadOnlyList<Tenant> GetTenants();

    IReadOnlyList<SiteEntry> GetSites();

    // One transaction, so a failure leaves nothing half saved.
    void SaveTenant(Tenant tenant, IReadOnlyList<SiteEntry> sites);

    void DeleteTenant(string id);
}
