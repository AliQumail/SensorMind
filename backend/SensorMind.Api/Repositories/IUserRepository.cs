using SensorMind.Api.Models;

namespace SensorMind.Api.Repositories;

public interface IUserRepository
{
    User? Find(string username);

    void AddIfMissing(User user);
}
