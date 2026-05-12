namespace VideoInstaller.Desktop.Models;

public sealed class DownloadRequest
{
    public string Website { get; init; } = string.Empty;

    public string VideoId { get; init; } = string.Empty;

    public string SourceUrl { get; init; } = string.Empty;

    public string Title { get; init; } = string.Empty;

    public string? PartIndex { get; init; }

    public string VideoFormatId { get; init; } = string.Empty;

    public string AudioFormatId { get; init; } = string.Empty;

    public string SingleFormatId { get; init; } = string.Empty;

    public string DownloadMode { get; init; } = string.Empty;

    public bool Transcode { get; init; }

    public string OutputDirectory { get; init; } = string.Empty;
}
