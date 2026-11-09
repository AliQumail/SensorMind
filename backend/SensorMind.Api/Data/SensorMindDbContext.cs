using SensorMind.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace SensorMind.Api.Data;

public sealed class SensorMindDbContext(DbContextOptions<SensorMindDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<SiteEntry> Sites => Set<SiteEntry>();

    public DbSet<LogEntry> Logs => Set<LogEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SensorMindDbContext).Assembly);
}
