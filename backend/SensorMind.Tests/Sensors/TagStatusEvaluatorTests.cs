using SensorMind.Core.Plant;
using SensorMind.Core.Sensors;

namespace SensorMind.Tests.Sensors;

public class TagStatusEvaluatorTests
{
    private static readonly Tag Tag = new("t", "T", "bar", NominalMin: 4, NominalMax: 6, AlarmLow: 2, AlarmHigh: 8);

    [Theory]
    [InlineData(5, TagStatus.Normal)]
    [InlineData(4, TagStatus.Normal)]
    [InlineData(6, TagStatus.Normal)]
    [InlineData(3.9, TagStatus.Warning)]
    [InlineData(7.9, TagStatus.Warning)]
    [InlineData(2, TagStatus.Alarm)]
    [InlineData(8, TagStatus.Alarm)]
    [InlineData(-10, TagStatus.Alarm)]
    public void Classifies_value_against_thresholds(double value, TagStatus expected) =>
        Assert.Equal(expected, Tag.Evaluate(value));

    [Fact]
    public void Without_alarm_limits_the_worst_status_is_warning() =>
        Assert.Equal(TagStatus.Warning, (Tag with { AlarmLow = null, AlarmHigh = null }).Evaluate(1000));
}
