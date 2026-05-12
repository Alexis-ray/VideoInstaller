namespace VideoInstaller.Desktop.Models;

public sealed class VideoParseResult
{
    public bool Success { get; init; }

    public string Error { get; init; } = string.Empty;

    public string Source { get; init; } = string.Empty;

    public SourceType SourceType { get; init; } = SourceType.Unknown;

    public string VideoId { get; init; } = string.Empty;

    public string Title { get; init; } = string.Empty;

    public string ThumbnailUrl { get; init; } = string.Empty;

    public List<string> ThumbnailCandidates { get; init; } = [];

    public string OriginalUrl { get; init; } = string.Empty;

    public VideoPart? CurrentPart { get; init; }

    public List<VideoPart> Parts { get; init; } = [];

    public List<MediaFormat> Audios { get; init; } = [];

    public List<MediaFormat> Videos { get; init; } = [];

    public string RawJsonPath { get; init; } = string.Empty;

    public string Note { get; init; } = string.Empty;
}
