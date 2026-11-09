using SensorMind.Core.Plant;

namespace SensorMind.Core.Sensors.Simulation;

// Ornstein-Uhlenbeck walk around the band centre plus Poisson drifts, spikes and short alarm excursions.
internal sealed class TagSimulator
{
    private readonly SimulationProfile _profile;
    private readonly Random _random;
    private readonly double _centre;
    private readonly double _halfBand;
    private readonly double _sigma;

    private double _value;

    private double _driftPeak;
    private double _driftDuration;
    private double _driftElapsed;

    private double _alarmTarget;
    private double _alarmRemaining;

    public TagSimulator(Tag tag, int seed, SimulationProfile profile)
    {
        Tag = tag;
        _profile = profile;
        _random = new Random(seed);
        _centre = (tag.NominalMin + tag.NominalMax) / 2;
        _halfBand = (tag.NominalMax - tag.NominalMin) / 2;

        // For dx = theta(mu - x)dt + sigma dW the stationary std is sigma / sqrt(2 theta).
        var theta = 1 / profile.MeanReversionSeconds;
        _sigma = profile.NoiseFraction * _halfBand * Math.Sqrt(2 * theta);

        _value = _centre + (NextGaussian() * profile.NoiseFraction * _halfBand);
    }

    public Tag Tag { get; }

    public double Step(double dtSeconds)
    {
        if (dtSeconds <= 0)
        {
            return Round(_value);
        }

        MaybeStartEvents(dtSeconds);

        double target;
        double reversionSeconds;
        if (_alarmRemaining > 0)
        {
            // Converge quickly on a point past the alarm limit.
            target = _alarmTarget;
            reversionSeconds = 15;
            _alarmRemaining -= dtSeconds;
        }
        else
        {
            target = _centre + AdvanceDrift(dtSeconds);
            reversionSeconds = _profile.MeanReversionSeconds;
        }

        // Euler-Maruyama step; accurate enough while dt is well below the reversion time constant.
        var pull = Math.Min(1, dtSeconds / reversionSeconds);
        _value += (pull * (target - _value)) + (_sigma * Math.Sqrt(dtSeconds) * NextGaussian());

        var output = _value;
        if (Occurs(_profile.SpikesPerHour, dtSeconds))
        {
            // Transient: affects the emitted sample, not the underlying process.
            output += Sign() * (0.8 + (0.7 * _random.NextDouble())) * _halfBand;
        }

        return Round(output);
    }

    private void MaybeStartEvents(double dtSeconds)
    {
        if (_driftDuration <= 0 && Occurs(_profile.DriftsPerHour, dtSeconds))
        {
            _driftPeak = Sign() * (0.4 + (0.6 * _random.NextDouble())) * _profile.MaxDriftFraction * _halfBand;
            _driftDuration = (10 + (30 * _random.NextDouble())) * 60;
            _driftElapsed = 0;
        }

        if (_alarmRemaining <= 0 && Occurs(_profile.AlarmEventsPerHour, dtSeconds))
        {
            _alarmTarget = PickAlarmTarget();
            _alarmRemaining = (1 + (3 * _random.NextDouble())) * 60;
        }
    }

    // Ramps to the peak at half time, then back to zero.
    private double AdvanceDrift(double dtSeconds)
    {
        if (_driftDuration <= 0)
        {
            return 0;
        }

        _driftElapsed += dtSeconds;
        var progress = _driftElapsed / _driftDuration;
        if (progress >= 1)
        {
            _driftDuration = 0;
            return 0;
        }

        return _driftPeak * (1 - Math.Abs((2 * progress) - 1));
    }

    private double PickAlarmTarget()
    {
        var margin = 0.15 * _halfBand;
        return (Tag.AlarmLow, Tag.AlarmHigh) switch
        {
            ({ } low, { } high) => _random.Next(2) == 0 ? low - margin : high + margin,
            ({ } low, null) => low - margin,
            (null, { } high) => high + margin,
            // No alarm limits defined: the best we can do is a pronounced warning.
            _ => Tag.NominalMax + _halfBand,
        };
    }

    private bool Occurs(double ratePerHour, double dtSeconds) =>
        ratePerHour > 0 && _random.NextDouble() < 1 - Math.Exp(-ratePerHour * dtSeconds / 3600);

    private int Sign() => _random.Next(2) == 0 ? -1 : 1;

    // Standard normal via Box-Muller.
    private double NextGaussian()
    {
        var u1 = 1 - _random.NextDouble();
        var u2 = _random.NextDouble();
        return Math.Sqrt(-2 * Math.Log(u1)) * Math.Cos(2 * Math.PI * u2);
    }

    private static double Round(double value) => Math.Round(value, 3);
}
