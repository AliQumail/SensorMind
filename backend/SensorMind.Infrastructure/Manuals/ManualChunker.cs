namespace SensorMind.Infrastructure.Manuals;

public static class ManualChunker
{
    // About 450 words is roughly 600 tokens, inside the 500 to 800 target. Overlap keeps a sentence that straddles a cut findable.
    private const int WordsPerChunk = 450;
    private const int OverlapWords = 60;

    /// <summary>Splits one page into overlapping chunks. Chunks never span pages, so every chunk has one page number.</summary>
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
