using SensorMind.Api.Models;

namespace SensorMind.Api.Services;

public static class TimeSeriesDownsampler
{
    // Averages equal-count buckets stamped with the middle timestamp; swap for LTTB if peaks matter.
    public static IReadOnlyList<DataPoint> Average(IReadOnlyList<DataPoint> points, int maxPoints)
    {
        ArgumentNullException.ThrowIfNull(points);
        ArgumentOutOfRangeException.ThrowIfLessThan(maxPoints, 1);

        if (points.Count <= maxPoints)
        {
            return points;
        }

        var result = new DataPoint[maxPoints];
        for (var bucket = 0; bucket < maxPoints; bucket++)
        {
            var start = (int)((long)bucket * points.Count / maxPoints);
            var end = (int)((long)(bucket + 1) * points.Count / maxPoints);

            var sum = 0d;
            for (var i = start; i < end; i++)
            {
                sum += points[i].Value;
            }

            result[bucket] = new DataPoint(points[(start + end - 1) / 2].Timestamp, sum / (end - start));
        }

        return result;
    }
}
