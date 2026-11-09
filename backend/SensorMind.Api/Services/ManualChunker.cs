
namespace SensorMind.Api.Services;

public static class ManualChunker
{
    // About 450 words is roughly 600 tokens (target 500 to 800); overlap keeps a sentence that straddles a cut findable.
    private const int WordsPerChunk = 450;
    private const int OverlapWords = 60;

    // Chunks never span pages, so each has one page number.
    public static IEnumerable<string> Split(string pageText)
    {
        var words = pageText.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        if (words.Length == 0)
        {
            yield break;
        }

        for (var start = 0; ; start += WordsPerChunk - OverlapWords)
        {
            var count = Math.Min(WordsPerChunk, words.Length - start);
            yield return string.Join(' ', words, start, count);
            if (start + count >= words.Length)
            {
                yield break;
            }
        }
    }
}
