using SensorMind.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SensorMind.Api.Data;

// Table and column names match the tables the app created before EF Core, so existing databases load unchanged.
internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        builder.HasKey(u => u.Username);
        builder.Property(u => u.Username).HasColumnName("username");
        builder.Property(u => u.PasswordHash).HasColumnName("password_hash");
        builder.Property(u => u.Role).HasColumnName("role");
    }
}

internal sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id");
        builder.Property(t => t.Name).HasColumnName("name");
    }
}

internal sealed class SiteEntryConfiguration : IEntityTypeConfiguration<SiteEntry>
{
    public void Configure(EntityTypeBuilder<SiteEntry> builder)
    {
        builder.ToTable("sites");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");
        builder.Property(s => s.TenantId).HasColumnName("tenant_id");
        builder.Property(s => s.Name).HasColumnName("name");
        builder.Property(s => s.ConfigJson).HasColumnName("config_json");
        builder.HasOne<Tenant>().WithMany().HasForeignKey(s => s.TenantId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class LogEntryConfiguration : IEntityTypeConfiguration<LogEntry>
{
    public void Configure(EntityTypeBuilder<LogEntry> builder)
    {
        builder.ToTable("logs");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).HasColumnName("id").ValueGeneratedOnAdd();
        builder.Property(l => l.TimestampUtc).HasColumnName("timestamp_utc");
        builder.Property(l => l.Type).HasColumnName("type");
        builder.Property(l => l.StatusCode).HasColumnName("status_code");
        builder.Property(l => l.Method).HasColumnName("method");
        builder.Property(l => l.Path).HasColumnName("path");
        builder.Property(l => l.LoggedInUser).HasColumnName("logged_in_user");
        builder.Property(l => l.ErrorMessage).HasColumnName("error_message");
    }
}
