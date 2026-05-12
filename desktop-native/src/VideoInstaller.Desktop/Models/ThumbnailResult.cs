namespace VideoInstaller.Desktop.Models;

public sealed class ThumbnailResult
{
    public bool Success { get; init; }

    public string Error { get; init; } = string.Empty;

    public string SavedPath { get; init; } = string.Empty;
}
