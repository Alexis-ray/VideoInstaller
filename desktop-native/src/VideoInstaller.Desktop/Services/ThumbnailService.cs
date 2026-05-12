using System.IO;
using System.Net;
using System.Net.Http;

namespace VideoInstaller.Desktop.Services;

public sealed class ThumbnailService
{
    public async Task<string> SaveAsync(string sourceUrl, string title, string videoId, string outputRoot, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(sourceUrl))
        {
            throw new InvalidOperationException("没有可保存的封面地址");
        }

        using var handler = new HttpClientHandler { AutomaticDecompression = DecompressionMethods.All };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(15) };
        var bytes = await client.GetByteArrayAsync(sourceUrl, cancellationToken);
        var extension = GuessExtension(sourceUrl);
        var safeTitle = Utils.FileNameSanitizer.Sanitize(title, videoId);
        var videoDir = Path.Combine(outputRoot, safeTitle);
        Directory.CreateDirectory(videoDir);
        var coverPath = Path.Combine(videoDir, $"cover{extension}");
        await File.WriteAllBytesAsync(coverPath, bytes, cancellationToken);
        return coverPath;
    }

    private static string GuessExtension(string sourceUrl)
    {
        var match = System.Text.RegularExpressions.Regex.Match(sourceUrl, "\\.([a-z0-9]+)(?:\\?|$)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!match.Success)
        {
            return ".jpg";
        }

        var ext = match.Groups[1].Value.ToLowerInvariant();
        return ext.StartsWith('.') ? ext : $".{ext}";
    }
}
