namespace SensorMind.Core.Auth;

public interface IUserRepository
{
    User? Find(string username);

    void AddIfMissing(User user);
}
