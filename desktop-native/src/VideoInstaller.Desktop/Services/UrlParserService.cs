using System.Text.RegularExpressions;
using VideoInstaller.Desktop.Models;

namespace VideoInstaller.Desktop.Services;

public sealed class UrlParserService
{
    public string NormalizeInput(string url)
    {
        return (url ?? string.Empty)
            .Trim()
            .Replace("y2b", "youtube", StringComparison.Ordinal)
            .Replace("y2", "youtu", StringComparison.Ordinal);
    }

    public ParsedVideoUrl? Parse(string inputUrl)
    {
        var input = NormalizeInput(inputUrl);
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        var y2bMatch = Regex.Match(input, "^https?:\\/\\/(?:youtu\\.be\\/|(?:www|m)\\.youtube\\.com\\/(?:watch|shorts)(?:\\/|\\?v=))([\\w-]{11})", RegexOptions.IgnoreCase);
        if (y2bMatch.Success)
        {
            var sourceType = Regex.IsMatch(input, "^https?:\\/\\/youtu\\.be\\/", RegexOptions.IgnoreCase)
                ? SourceType.YouTubeShortlink
                : Regex.IsMatch(input, "\\/shorts(?:\\/|\\?|$)", RegexOptions.IgnoreCase)
                    ? SourceType.YouTubeShort
                    : SourceType.YouTubeWatch;

            return new ParsedVideoUrl
            {
                Website = "y2b",
                SourceType = sourceType,
                VideoId = y2bMatch.Groups[1].Value,
                OriginalUrl = inputUrl.Trim(),
                NormalizedUrl = input,
                SourceUrl = input
            };
        }

        var bilibiliVideoMatch = Regex.Match(input, "^https?:\\/\\/(?:www\\.)?bilibili\\.com\\/video\\/(BV[0-9A-Za-z]{10}|av\\d+)", RegexOptions.IgnoreCase);
        if (bilibiliVideoMatch.Success)
        {
            var pMatch = Regex.Match(input, "[?&]p=(\\d+)", RegexOptions.IgnoreCase);
            return new ParsedVideoUrl
            {
                Website = "b2b",
                SourceType = pMatch.Success ? SourceType.BilibiliPart : SourceType.BilibiliVideo,
                VideoId = bilibiliVideoMatch.Groups[1].Value,
                Part = pMatch.Success ? int.Parse(pMatch.Groups[1].Value).ToString() : null,
                OriginalUrl = inputUrl.Trim(),
                NormalizedUrl = input,
                SourceUrl = input
            };
        }

        var bangumiMatch = Regex.Match(input, "^https?:\\/\\/(?:www\\.)?bilibili\\.com\\/bangumi\\/play\\/(ep\\d+|ss\\d+)", RegexOptions.IgnoreCase);
        if (bangumiMatch.Success)
        {
            var sourceType = bangumiMatch.Groups[1].Value.StartsWith("ep", StringComparison.OrdinalIgnoreCase)
                ? SourceType.BilibiliBangumiEpisode
                : SourceType.BilibiliBangumiSeason;

            return new ParsedVideoUrl
            {
                Website = "b2b",
                SourceType = sourceType,
                VideoId = bangumiMatch.Groups[1].Value,
                OriginalUrl = inputUrl.Trim(),
                NormalizedUrl = input,
                SourceUrl = input
            };
        }

        var medialistMatch = Regex.Match(input, "^https?:\\/\\/(?:www\\.)?bilibili\\.com\\/medialist\\/play\\/(ml\\d+)", RegexOptions.IgnoreCase);
        if (medialistMatch.Success)
        {
            return new ParsedVideoUrl
            {
                Website = "b2b",
                SourceType = SourceType.BilibiliMedialist,
                VideoId = medialistMatch.Groups[1].Value,
                OriginalUrl = inputUrl.Trim(),
                NormalizedUrl = input,
                SourceUrl = input
            };
        }

        if (Regex.IsMatch(input, "^https?:\\/\\/b23\\.tv\\/", RegexOptions.IgnoreCase))
        {
            return new ParsedVideoUrl
            {
                Website = "b2b",
                SourceType = SourceType.BilibiliShort,
                OriginalUrl = inputUrl.Trim(),
                NormalizedUrl = input,
                SourceUrl = input
            };
        }

        if (Regex.IsMatch(input, "^https?:\\/\\/(?:www\\.)?bilibili\\.com\\/", RegexOptions.IgnoreCase))
        {
            return new ParsedVideoUrl
            {
                Website = "b2b",
                SourceType = SourceType.BilibiliVideo,
                VideoId = ExtractBilibiliId(input),
                OriginalUrl = inputUrl.Trim(),
                NormalizedUrl = input,
                SourceUrl = input
            };
        }

        return null;
    }

    public string ExtractBilibiliId(string url)
    {
        var match = Regex.Match(url ?? string.Empty, "(?:\\/video\\/)(BV[0-9A-Za-z]{10}|av\\d+)|(?:\\/bangumi\\/play\\/)(ep\\d+|ss\\d+)|(?:\\/medialist\\/play\\/)(ml\\d+)", RegexOptions.IgnoreCase);
        return match.Success ? (match.Groups[1].Value + match.Groups[2].Value + match.Groups[3].Value).Trim() : string.Empty;
    }
}
