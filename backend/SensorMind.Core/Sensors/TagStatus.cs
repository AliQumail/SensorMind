using SensorMind.Core.Plant;

namespace SensorMind.Core.Sensors;

/// <summary>Ordered by severity so the worst status of a set is simply the maximum.</summary>
public enum TagStatus
{
    Normal = 0,
    Warning = 1,
    Alarm = 2,
}

public static class TagStatusEvaluator
{
    /// <summary>Alarm beyond an alarm limit (inclusive), warning outside the nominal band, otherwise normal.</summary>
    public static TagStatus Evaluate(this Tag tag, double value)
    {
        ArgumentNullException.ThrowIfNull(tag);

        if ((tag.AlarmLow is { } low && value <= low) || (tag.AlarmHigh is { } high && value >= high))
        {
            return TagStatus.Alarm;
        }

        return value < tag.NominalMin || value > tag.NominalMax ? TagStatus.Warning : TagStatus.Normal;
    }
}
