using Microsoft.EntityFrameworkCore;
using SensorMind.Core.Auth;
using SensorMind.Core.Sites;

namespace SensorMind.Infrastructure.Data;

public sealed class SensorMindDbContext(DbContextOptions<SensorMindDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<SiteEntry> Sites => Set<SiteEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SensorMindDbContext).Assembly);
}
