using SensorMind.Api.Models;
using SensorMind.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace SensorMind.Api.Repositories;

internal sealed class TenantRepository(IDbContextFactory<SensorMindDbContext> factory) : ITenantRepository
{
    public IReadOnlyList<Tenant> GetTenants()
    {
        using var db = factory.CreateDbContext();
        return db.Tenants.AsNoTracking().OrderBy(t => t.Name).ToList();
    }

    public IReadOnlyList<SiteEntry> GetSites()
    {
        using var db = factory.CreateDbContext();
        return db.Sites.AsNoTracking().OrderBy(s => s.Name).ToList();
    }

    public void SaveTenant(Tenant tenant, IReadOnlyList<SiteEntry> sites)
    {
        using var db = factory.CreateDbContext();
        using var transaction = db.Database.BeginTransaction();

        if (db.Tenants.Any(t => t.Id == tenant.Id))
        {
            db.Tenants.Update(tenant);
        }
        else
        {
            db.Tenants.Add(tenant);
        }

        db.Sites.Where(s => s.TenantId == tenant.Id).ExecuteDelete();
        db.Sites.AddRange(sites);
        db.SaveChanges();
        transaction.Commit();
    }

    public void DeleteTenant(string id)
    {
        using var db = factory.CreateDbContext();
        db.Tenants.Where(t => t.Id == id).ExecuteDelete();
    }
}
