namespace SensorMind.Core.Auth;

public interface IUserRepository
{
    User? Find(string username);

    /// <summary>Adds the user unless one with the same username already exists.</summary>
    void AddIfMissing(User user);
}
