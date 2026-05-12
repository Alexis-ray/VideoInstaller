namespace VideoInstaller.Desktop.Models;

public sealed class DownloadProgress
{
    public DownloadPhase Phase { get; init; }

    public string Message { get; init; } = string.Empty;

    public double? Percent { get; init; }

    public string Speed { get; init; } = string.Empty;

    public string Eta { get; init; } = string.Empty;

    public string CurrentFile { get; init; } = string.Empty;

    public bool IsIndeterminate { get; init; }
}
