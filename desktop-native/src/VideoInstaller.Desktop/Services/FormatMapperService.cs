using System.Text.Json;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Utils;

namespace VideoInstaller.Desktop.Services;

public sealed class FormatMapperService
{
    public (List<MediaFormat> audios, List<MediaFormat> videos) ParseFormats(JsonElement formats)
    {
        var audios = new List<MediaFormat>();
        var videos = new List<MediaFormat>();

        foreach (var format in formats.EnumerateArray())
        {
            var fileSize = GetNullableInt64(format, "filesize") ?? GetNullableInt64(format, "filesize_approx");
            var fileSizeText = SizeFormatter.FormatBytes(fileSize);
            var ext = GetString(format, "ext", "未知");
            var formatId = GetString(format, "format_id");
            var formatNote = GetString(format, "format_note", "无描述");

            var videoExt = GetString(format, "video_ext");
            if (!string.IsNullOrWhiteSpace(videoExt) && !string.Equals(videoExt, "none", StringComparison.OrdinalIgnoreCase))
            {
                videos.Add(new MediaFormat
                {
                    FormatId = formatId,
                    Ext = ext,
                    Kind = "video",
                    Resolution = GetString(format, "resolution", GetNullableInt32(format, "height") is int height && height > 0 ? $"{height}p" : "未知"),
                    Width = GetNullableInt32(format, "width") ?? 0,
                    Height = GetNullableInt32(format, "height") ?? 0,
                    VideoCodec = GetString(format, "vcodec", "未知"),
                    AudioCodec = GetString(format, "acodec", string.Empty),
                    Bitrate = GetNullableDouble(format, "vbr") ?? 0,
                    FileSize = fileSize,
                    FileSizeText = fileSizeText,
                    Description = formatNote,
                    ContainerText = ext,
                    BitrateText = (GetNullableDouble(format, "vbr") is double vbr && vbr > 0) ? $"{Math.Round(vbr)}kbps" : "未知",
                    FrameText = (GetNullableDouble(format, "fps") is double fps && fps > 0) ? $"{fps}fps" : "未知",
                    RawJson = format.GetRawText()
                });
                continue;
            }

            var audioExt = GetString(format, "audio_ext");
            if (!string.IsNullOrWhiteSpace(audioExt) && !string.Equals(audioExt, "none", StringComparison.OrdinalIgnoreCase))
            {
                audios.Add(new MediaFormat
                {
                    FormatId = formatId,
                    Ext = ext,
                    Kind = "audio",
                    Resolution = string.Empty,
                    VideoCodec = string.Empty,
                    AudioCodec = GetString(format, "acodec", "未知"),
                    Bitrate = GetNullableDouble(format, "abr") ?? 0,
                    FileSize = fileSize,
                    FileSizeText = fileSizeText,
                    Description = formatNote,
                    ContainerText = ext,
                    BitrateText = (GetNullableDouble(format, "abr") is double abr && abr > 0) ? $"{Math.Round(abr)}kbps" : "未知",
                    FrameText = string.Empty,
                    RawJson = format.GetRawText()
                });
            }
        }

        var bestAudioId = audios.OrderByDescending(item => item.Bitrate).Select(item => item.FormatId).FirstOrDefault();
        var bestVideoId = videos.OrderByDescending(item => item.Height).ThenByDescending(item => item.Bitrate).Select(item => item.FormatId).FirstOrDefault();

        audios = audios.Select(item => item.WithBest(item.FormatId == bestAudioId)).ToList();
        videos = videos.Select(item => item.WithBest(item.FormatId == bestVideoId)).ToList();

        return (audios, videos);
    }

    public List<VideoPart> BuildPartsFromEntries(JsonElement? entries, string baseUrl)
    {
        if (entries is null || entries.Value.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var values = entries.Value.EnumerateArray().ToList();
        if (values.Count <= 1)
        {
            return [];
        }

        return values.Select((entry, index) =>
        {
            var partNumber = index + 1;
            var title = GetString(entry, "title", $"分P {partNumber}").Trim();
            var entryUrl = GetString(entry, "webpage_url", GetString(entry, "url"));
            return new VideoPart
            {
                Index = partNumber,
                Id = partNumber.ToString(),
                Title = string.IsNullOrWhiteSpace(title) ? $"分P {partNumber}" : title,
                Url = string.IsNullOrWhiteSpace(entryUrl) ? AppendPartToUrl(baseUrl, partNumber.ToString()) : entryUrl
            };
        }).ToList();
    }

    public string AppendPartToUrl(string url, string part)
    {
        var text = (url ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        var cleaned = System.Text.RegularExpressions.Regex.Replace(text, "([?&])p=\\d+", "$1", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        cleaned = cleaned.TrimEnd('?', '&');
        return cleaned.Contains('?') ? $"{cleaned}&p={part}" : $"{cleaned}?p={part}";
    }

    private static string GetString(JsonElement element, string propertyName, string fallback = "")
    {
        return element.TryGetProperty(propertyName, out var value) && value.ValueKind != JsonValueKind.Null
            ? value.ToString() ?? fallback
            : fallback;
    }

    private static int? GetNullableInt32(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var intValue))
        {
            return intValue;
        }

        return int.TryParse(value.ToString(), out var parsed) ? parsed : null;
    }

    private static long? GetNullableInt64(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var longValue))
        {
            return longValue;
        }

        return long.TryParse(value.ToString(), out var parsed) ? parsed : null;
    }

    private static double? GetNullableDouble(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var doubleValue))
        {
            return doubleValue;
        }

        return double.TryParse(value.ToString(), out var parsed) ? parsed : null;
    }
}

file static class MediaFormatExtensions
{
    public static MediaFormat WithBest(this MediaFormat item, bool isBest)
    {
        return new MediaFormat
        {
            FormatId = item.FormatId,
            Ext = item.Ext,
            Kind = item.Kind,
            Resolution = item.Resolution,
            Width = item.Width,
            Height = item.Height,
            VideoCodec = item.VideoCodec,
            AudioCodec = item.AudioCodec,
            Bitrate = item.Bitrate,
            FileSize = item.FileSize,
            FileSizeText = item.FileSizeText,
            Description = item.Description,
            ContainerText = item.ContainerText,
            BitrateText = item.BitrateText,
            FrameText = item.FrameText,
            IsBest = isBest,
            RawJson = item.RawJson
        };
    }
}
