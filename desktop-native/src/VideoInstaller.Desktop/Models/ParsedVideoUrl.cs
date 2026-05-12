namespace VideoInstaller.Desktop.Models;

public sealed class ParsedVideoUrl
{
    public string Website { get; init; } = string.Empty;

    public SourceType SourceType { get; init; } = SourceType.Unknown;

    public string VideoId { get; init; } = string.Empty;

    public string? Part { get; init; }

    public string OriginalUrl { get; init; } = string.Empty;

    public string NormalizedUrl { get; init; } = string.Empty;

    public string SourceUrl { get; init; } = string.Empty;
}
