using SensorMind.Api.Models;
using SensorMind.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace SensorMind.Api.Repositories;

internal sealed class UserRepository(IDbContextFactory<SensorMindDbContext> factory) : IUserRepository
{
    public User? Find(string username)
    {
        using var db = factory.CreateDbContext();
        return db.Users.AsNoTracking().FirstOrDefault(u => u.Username == username);
    }

    public void AddIfMissing(User user)
    {
        using var db = factory.CreateDbContext();
        if (db.Users.Any(u => u.Username == user.Username))
        {
            return;
        }

        db.Users.Add(user);
        db.SaveChanges();
    }
}
