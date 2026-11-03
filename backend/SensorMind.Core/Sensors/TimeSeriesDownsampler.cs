namespace SensorMind.Core.Sensors;

public static class TimeSeriesDownsampler
{
    /// <summary>
    /// Reduces a series to at most <paramref name="maxPoints"/> by averaging equal-count buckets.
    /// Each bucket is stamped with its middle sample's timestamp. Cheap, stable, and good enough for
    /// sparklines and trend charts; swap for LTTB if peak preservation becomes important.
    /// </summary>
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
