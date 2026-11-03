using SensorMind.Core.Sensors;

namespace SensorMind.Tests.Sensors;

public class TimeSeriesDownsamplerTests
{
    private static readonly DateTimeOffset Start = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Returns_input_when_already_small_enough()
    {
        var points = Series(10);

        Assert.Same(points, TimeSeriesDownsampler.Average(points, 10));
    }

    [Fact]
    public void Averages_into_requested_number_of_buckets()
    {
        var result = TimeSeriesDownsampler.Average(Series(100), 10);

        Assert.Equal(10, result.Count);
        Assert.Equal(4.5, result[0].Value); // mean of 0..9
        Assert.Equal(94.5, result[9].Value);
        Assert.True(result.Zip(result.Skip(1)).All(p => p.First.Timestamp < p.Second.Timestamp));
    }

    [Fact]
    public void Handles_uneven_bucket_sizes()
    {
        var result = TimeSeriesDownsampler.Average(Series(10), 3);

        Assert.Equal(3, result.Count);
        Assert.Equal(Enumerable.Range(0, 10).Average(), result.Select(p => p.Value).Average(), precision: 0);
    }

    private static List<DataPoint> Series(int count) =>
        [.. Enumerable.Range(0, count).Select(i => new DataPoint(Start.AddSeconds(i), i))];
}
