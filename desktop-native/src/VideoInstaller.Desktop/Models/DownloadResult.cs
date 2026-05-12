namespace VideoInstaller.Desktop.Models;

public sealed class DownloadResult
{
    public bool Success { get; init; }

    public string Error { get; init; } = string.Empty;

    public string OutputDirectory { get; init; } = string.Empty;

    public string MainFile { get; init; } = string.Empty;

    public string AudioFile { get; init; } = string.Empty;

    public string VideoFile { get; init; } = string.Empty;

    public string MetadataFile { get; init; } = string.Empty;

    public string ThumbnailFile { get; init; } = string.Empty;

    public string TranscodedFile { get; init; } = string.Empty;
}
